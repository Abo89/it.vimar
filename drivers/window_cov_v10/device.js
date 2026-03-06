"use strict";

const { ZigBeeDevice } = require("homey-zigbeedriver");
const { Cluster, CLUSTER } = require("zigbee-clusters");
const TuyaWindowCoveringCluster = require("../../lib/TuyaWindowCoveringCluster");
const { mapValueRange } = require('../../lib/util');

Cluster.addCluster(TuyaWindowCoveringCluster);

const UP_OPEN = 'upOpen';
const DOWN_CLOSE = 'downClose';
const REPORT_DEBOUNCER = 5000;
// How often (ms) to poll the device for its current position.
// Polling is used as a fallback because some devices do not reliably send
// attribute reports for currentPositionLiftPercentage on their own.
const POSITION_POLL_INTERVAL = 5000;

class curtain_module extends ZigBeeDevice {

    // Set to true when the device reports 0% as fully open (i.e. inverted scale).
    get invertPercentageLiftValue() {
        return this.getSetting('invert_percentage') ?? true;
    }

    constructor(...args) {
        super(...args);
        this._reportPercentageDebounce = null;
        this._reportDebounceEnabled = false;
        this._positionPollInterval = null;
    }

    async onNodeInit({ zclNode }) {
        await super.onNodeInit({ zclNode });
        this.printNode();

        // Handles lift percentage with optional inversion.
        // Based on the most recent version of zigbee-driver's windowCovering capability handler:
        // https://github.com/athombv/node-homey-zigbeedriver/blob/master/lib/system/capabilities/windowcoverings_set/windowCovering.js
        // This can be removed once the package is updated.
        this.registerCapability(
            "windowcoverings_set",
            CLUSTER.WINDOW_COVERING,
            {
                setParser: async (value) => {
                    // Start or refresh the debounce timer so that incoming attribute reports
                    // do not overwrite the capability value while a set command is in flight.
                    if (this._reportPercentageDebounce) {
                        this._reportPercentageDebounce.refresh();
                    } else {
                        this._reportPercentageDebounce = this.homey.setTimeout(() => {
                            this._reportDebounceEnabled = false;
                            this._reportPercentageDebounce = null;
                        }, REPORT_DEBOUNCER);
                    }
                    this._reportDebounceEnabled = true;

                    // At the extremes (0 / 1) send a hard open/close command instead of
                    // goToLiftPercentage so the blind travels to its end-stop reliably.
                    if (value === 0 || value === 1) {
                        this.debug(`set → \`windowcoverings_set\`: ${value} → setParser → ${value === 1 ? UP_OPEN : DOWN_CLOSE}`);
                        const { endpoint } = this._getClusterCapabilityConfiguration('windowcoverings_set', CLUSTER.WINDOW_COVERING);
                        const windowCoveringEndpoint = endpoint ?? this.getClusterEndpoint(CLUSTER.WINDOW_COVERING);
                        if (windowCoveringEndpoint === null) throw new Error('missing_window_covering_cluster');

                        const windowCoveringCommand = value === 1 ? UP_OPEN : DOWN_CLOSE;
                        await this.zclNode.endpoints[windowCoveringEndpoint].clusters
                            .windowCovering[windowCoveringCommand]();

                        await this.setCapabilityValue('windowcoverings_set', value);
                        return null;
                    }

                    const mappedValue = mapValueRange(
                        0, 1, 0, 100, this.invertPercentageLiftValue ? 1 - value : value,
                    );
                    const goToLiftPercentageCommand = {
                        // Round to nearest integer — some devices reject fractional values.
                        percentageLiftValue: Math.round(mappedValue),
                    };
                    this.debug(`set → \`windowcoverings_set\`: ${value} → setParser → goToLiftPercentage`, goToLiftPercentageCommand);
                    return goToLiftPercentageCommand;
                },
                reportParser: (value) => {
                    if (value < 0 || value > 100) return null;

                    const parsedValue = mapValueRange(
                        0, 100, 0, 1, this.invertPercentageLiftValue ? 100 - value : value,
                    );

                    if (this._reportPercentageDebounce) {
                        this._reportPercentageDebounce.refresh();
                    }

                    // Only forward the report when it was not triggered by a Homey set command.
                    if (!this._reportDebounceEnabled) return parsedValue;

                    return null;
                },
            }
        );

        this._startPositionPolling();
        await this._configureStateCapability(this.getSetting("has_state"));
    }

    // Polls the device every POSITION_POLL_INTERVAL ms as a fallback for devices that
    // do not reliably push currentPositionLiftPercentage attribute reports.
    _startPositionPolling() {
        this._positionPollInterval = setInterval(async () => {
            const windowCoveringEndpoint = this.getClusterEndpoint(CLUSTER.WINDOW_COVERING);
            if (windowCoveringEndpoint === null) {
                this.error('_startPositionPolling: missing_window_covering_cluster');
                return;
            }

            const attributes = await this.zclNode.endpoints[windowCoveringEndpoint].clusters.windowCovering
                .readAttributes("currentPositionLiftPercentage")
                .catch((err) => {
                    this.error("Error reading currentPositionLiftPercentage from device", err);
                    return {};
                });

            if (attributes.currentPositionLiftPercentage == null) return;

            // Convert 0–100 device value to the 0–1 Homey capability range, respecting inversion.
            const raw = attributes.currentPositionLiftPercentage / 100;
            const position = this.invertPercentageLiftValue ? 1 - raw : raw;
            this.debug(`_startPositionPolling: raw=${raw} position=${position}`);

            // Skip update while a set command debounce is active to avoid fighting with the UI.
            if (!this._reportDebounceEnabled) {
                await this.setCapabilityValue('windowcoverings_set', position);
            }
        }, POSITION_POLL_INTERVAL);
    }

    // When upgrading to node-zigbee-clusters v2.0.0 this must be addressed:
    // readAttributes signature changed — attributes must now be passed as an array of strings:
    // zclNode.endpoints[1].clusters.windowCovering.readAttributes(['currentPositionLiftPercentage']);

    async onSettings({ oldSettings, newSettings, changedKeys }) {
        try {
            if (changedKeys.includes("has_state")) {
                await this._configureStateCapability(newSettings["has_state"]);
            }
        } catch (e) {
            this.error("Error during setting change", e);
        }
    }

    onDeleted() {
        this.log("Curtain Module removed");
        this._clearPositionPolling();
    }

    onUninit() {
        if (this._reportPercentageDebounce) {
            this.homey.clearTimeout(this._reportPercentageDebounce);
        }
        this._clearPositionPolling();
    }

    _clearPositionPolling() {
        if (this._positionPollInterval) {
            clearInterval(this._positionPollInterval);
            this._positionPollInterval = null;
        }
    }

    async _configureStateCapability(hasState) {
        const key = "windowcoverings_state";

        if (hasState) {
            if (!this.hasCapability(key)) {
                await this.addCapability(key);
            }

            this.registerCapability(key, CLUSTER.WINDOW_COVERING, {
                report: "windowCoverStatus",
                reportParser: (val) => {
                    return {
                        Open: "up",
                        Stop: "idle",
                        Close: "down",
                    }[val] ?? null;
                },
                reportOpts: {
                    configureAttributeReporting: {
                        minInterval: 60,    // 1 minute
                        maxInterval: 21600, // 6 hours
                        minChange: 1,
                    },
                },
            });
        } else if (this.hasCapability(key)) {
            await this.removeCapability(key);
        }
    }

}

module.exports = curtain_module;