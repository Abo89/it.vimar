'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');
const { CLUSTER } = require('zigbee-clusters');

// Uncomment to enable ZigBee cluster debug logging:
// const { debug } = require('zigbee-clusters');
// debug(true);

// Endpoint 11 — dimmer load (onOff + levelControl input clusters)
const ENDPOINT_LOAD = 11;
// Endpoint 10 — physical button (onOff + levelControl output/binding clusters)
const ENDPOINT_BUTTON = 10;

class VimarDimmerSwitch extends ZigBeeDevice {

  async onNodeInit({ zclNode }) {
    await super.onNodeInit({ zclNode });

    // Uncomment to enable debug logging:
    // this.enableDebug();
    // this.printNode();

    // -------------------------------------------------------------------------
    // onoff — endpoint 11
    // -------------------------------------------------------------------------
    this.registerCapability('onoff', CLUSTER.ON_OFF, {
      endpoint: ENDPOINT_LOAD,
    });

    // -------------------------------------------------------------------------
    // dim — endpoint 11
    // -------------------------------------------------------------------------
    this.registerCapability('dim', CLUSTER.LEVEL_CONTROL, {
      endpoint: ENDPOINT_LOAD,
    });

    // -------------------------------------------------------------------------
    // Physical button sync — endpoint 10
    // Bind the button endpoint so that physical presses update Homey state.
    // -------------------------------------------------------------------------
    await this._syncPhysicalButton(zclNode);

    // -------------------------------------------------------------------------
    // measure_power / meter_power
    // NOTE: The device interview does not expose ELECTRICAL_MEASUREMENT
    // (cluster 0x0B04) or METERING (cluster 0x0702) clusters. These
    // registrations are included in case a firmware update adds support,
    // but they are unlikely to report values on current hardware.
    // -------------------------------------------------------------------------
    this.registerCapability('measure_power', CLUSTER.ELECTRICAL_MEASUREMENT, {
      endpoint: ENDPOINT_LOAD,
      reportParser: (value) => {
        if (value < 0) return null;
        // Raw value is in 10mW units — convert to Watts.
        return value / 10;
      },
      getOpts: {
        getOnStart: true,
        pollInterval: 60000,
      },
    });

    this.registerCapability('meter_power', CLUSTER.METERING, {
      endpoint: ENDPOINT_LOAD,
      reportParser: (value) => {
        if (value < 0) return null;
        // Raw value is in Wh — convert to kWh.
        return value / 1000;
      },
      getOpts: {
        getOnStart: true,
        pollInterval: 300000,
      },
    });
  }

  // Listens to onOff and levelControl reports from the physical button endpoint
  // (ep 10) and mirrors them onto the load endpoint capabilities so Homey stays
  // in sync when the device is operated manually.
  async _syncPhysicalButton(zclNode) {
    const buttonEndpoint = zclNode.endpoints[ENDPOINT_BUTTON];
    if (!buttonEndpoint) {
      this.error('_syncPhysicalButton: endpoint 10 not found');
      return;
    }

    // Mirror onOff state changes from button → Homey
    buttonEndpoint.clusters.onOff.on('attr.onOff', (value) => {
      this.debug(`Physical button → onOff: ${value}`);
      this.setCapabilityValue('onoff', value).catch((err) =>
        this.error('Failed to set onoff from physical button', err)
      );
    });

    // Mirror level changes from button → Homey
    buttonEndpoint.clusters.levelControl.on('attr.currentLevel', (value) => {
      // currentLevel is 0–254 — map to 0–1 for Homey dim capability
      const dimValue = Math.min(Math.max(value / 254, 0), 1);
      this.debug(`Physical button → dim: ${dimValue}`);
      this.setCapabilityValue('dim', dimValue).catch((err) =>
        this.error('Failed to set dim from physical button', err)
      );
    });
  }

  onDeleted() {
    this.log('VimarDimmerSwitch removed');
  }

}

module.exports = VimarDimmerSwitch;