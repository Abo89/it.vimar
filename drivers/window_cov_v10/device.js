'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');
const { CLUSTER } = require('zigbee-clusters');

/**
 * Vimar venetian blind (modelId "Window_Cov_v1.0").
 *
 * This is a standard ZCL Window Covering device (cluster 258) on endpoint 10.
 * Per its interview it reports windowCoveringType "tiltBlindLiftAndTilt" and
 * accepts the standard commands: upOpen, downClose, stop, goToLiftPercentage
 * and goToTiltPercentage. It does NOT implement any Tuya-proprietary attributes,
 * so the built-in homey-zigbeedriver system capabilities are used directly.
 */
class WindowCovV10Device extends ZigBeeDevice {

    async onNodeInit({ zclNode }) {
        await super.onNodeInit({ zclNode });

        if (process.env.DEBUG === '1') this.printNode();

        // Lift position. ZCL currentPositionLiftPercentage: 0 = fully open, 100 = fully closed.
        // The system handler maps this to Homey's windowcoverings_set (1 = open, 0 = closed),
        // and sends a hard upOpen/downClose at the extremes so the blind reaches its end-stop.
        this.registerCapability('windowcoverings_set', CLUSTER.WINDOW_COVERING, {
            reportOpts: {
                configureAttributeReporting: {
                    minInterval: 0,      // report as fast as the device allows
                    maxInterval: 3600,   // and at least once an hour
                    minChange: 1,        // when changed by >= 1%
                },
            },
        });

        // Tilt position (venetian blind slats). The device reports tiltBlindLiftAndTilt
        // and accepts goToTiltPercentage, so expose the tilt capability as well.
        // Devices paired before v1.4.3 don't have it yet: add it on the fly.
        if (!this.hasCapability('windowcoverings_tilt_set')) {
            await this.addCapability('windowcoverings_tilt_set').catch(this.error);
        }
        this.registerCapability('windowcoverings_tilt_set', CLUSTER.WINDOW_COVERING, {
            // The system parsers neither round the outgoing value (uint8 on the wire)
            // nor reject out-of-range reports (e.g. 255 = position unknown).
            setParser: value => ({
                percentageTiltValue: Math.round(value * 100),
            }),
            reportParser: value => {
                if (value < 0 || value > 100) return null;
                return value / 100;
            },
        });

        // Tilt reporting is configured explicitly (not via reportOpts, which only runs on
        // the first init after pairing) so that devices paired before v1.4.3 get it too.
        if (!this.getStoreValue('tiltReportingConfigured')) {
            this.configureAttributeReporting([{
                endpointId: this.getClusterEndpoint(CLUSTER.WINDOW_COVERING),
                cluster: CLUSTER.WINDOW_COVERING,
                attributeName: 'currentPositionTiltPercentage',
                minInterval: 0,
                maxInterval: 3600,
                minChange: 1,
            }])
                .then(() => this.setStoreValue('tiltReportingConfigured', true))
                .catch(err => this.error('configureAttributeReporting (tilt) failed', err));
        }

        // Up / Idle / Down buttons. The system handler simply sends
        // upOpen / stop / downClose; no attribute reporting is involved.
        this.registerCapability('windowcoverings_state', CLUSTER.WINDOW_COVERING);
    }

    onDeleted() {
        this.log('Vimar window covering removed');
    }

}

module.exports = WindowCovV10Device;
