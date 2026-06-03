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
    // raw acPower values (reported in 10mW units) to Watts correctly.
    const windowCoveringEndpoint = this.getClusterEndpoint(CLUSTER.ELECTRICAL_MEASUREMENT);
    if (windowCoveringEndpoint !== null) {
      const { acPowerMultiplier, acPowerDivisor } = await zclNode
        .endpoints[windowCoveringEndpoint].clusters.electricalMeasurement
        .readAttributes(['acPowerMultiplier', 'acPowerDivisor'])
        .catch((err) => {
          this.error('Failed to read acPowerMultiplier/acPowerDivisor, falling back to defaults', err);
          return { acPowerMultiplier: 1, acPowerDivisor: 10 };
        });

      this._powerMultiplier = acPowerMultiplier ?? 1;
      this._powerDivisor = acPowerDivisor ?? 10;
    } else {
      this._powerMultiplier = 1;
      this._powerDivisor = 10;
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