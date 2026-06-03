'use strict';

const { ZigBeeDriver } = require('homey-zigbeedriver');

class VimarDimmerSwitchDriver extends ZigBeeDriver {

  async onInit() {
    this.log('VimarDimmerSwitchDriver has been initialized');
  }

}

module.exports = VimarDimmerSwitchDriver;
