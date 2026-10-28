'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');
const { CLUSTER } = require('zigbee-clusters');

// Uncomment to enable debug logging:
// const { debug } = require('zigbee-clusters');
// debug(true);

class MainsPowerOutlet extends ZigBeeDevice {

  async onNodeInit({ zclNode }) {
    await super.onNodeInit({ zclNode });

    // Uncomment to enable debug logging:
    // this.enableDebug();
    // this.printNode();

    this.registerCapability('onoff', CLUSTER.ON_OFF);

    // Read the device's power multiplier/divisor on init so we can scale
    // raw acPower values to Watts correctly (W = acPower * multiplier / divisor).
    // Fallbacks match the values reported by the device in its interview (10 / 1).
    const electricalMeasurementEndpoint = this.getClusterEndpoint(CLUSTER.ELECTRICAL_MEASUREMENT);
    if (electricalMeasurementEndpoint !== null) {
      const { acPowerMultiplier, acPowerDivisor } = await zclNode
        .endpoints[electricalMeasurementEndpoint].clusters.electricalMeasurement
        .readAttributes(['acPowerMultiplier', 'acPowerDivisor'])
        .catch((err) => {
          this.error('Failed to read acPowerMultiplier/acPowerDivisor, falling back to defaults', err);
          return { acPowerMultiplier: 10, acPowerDivisor: 1 };
        });

      this._powerMultiplier = acPowerMultiplier ?? 10;
      this._powerDivisor = acPowerDivisor || 1;
    } else {
      this._powerMultiplier = 10;
      this._powerDivisor = 1;
    }

    this.registerCapability('measure_power', CLUSTER.ELECTRICAL_MEASUREMENT, {
      reportParser: (value) => {
        if (value < 0) return null;
        return (value * this._powerMultiplier) / this._powerDivisor;
      },
      getOpts: {
        getOnStart: true,
        pollInterval: 10000,
      },
    });
  }

  onDeleted() {
    this.log('MainsPowerOutlet removed');
  }

}

module.exports = MainsPowerOutlet;