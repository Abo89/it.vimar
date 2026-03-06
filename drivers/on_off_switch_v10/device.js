'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');
const { CLUSTER } = require('zigbee-clusters');

// Uncomment to enable ZigBee cluster debug logging:
// const { debug } = require('zigbee-clusters');
// debug(true);

class ControlOutlet extends ZigBeeDevice {

  async onNodeInit({ zclNode }) {
    await super.onNodeInit({ zclNode });

    this.registerCapability('onoff', CLUSTER.ON_OFF);
  }

  onDeleted() {
    this.log('ControlOutlet removed');
  }

}

module.exports = ControlOutlet;