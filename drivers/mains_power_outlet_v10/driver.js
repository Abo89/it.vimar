'use strict';

const { ZigBeeDriver } = require('homey-zigbeedriver');

class MainsPowerOutletDriver extends ZigBeeDriver {

  async onInit() {
    this.log('MainsPowerOutletDriver has been initialized');
  }

}

module.exports = MainsPowerOutletDriver;
