'use strict';

const { ZigBeeDriver } = require('homey-zigbeedriver');

class VimarOnOffSwitchDriver extends ZigBeeDriver {

  async onInit() {
    this.log('VimarOnOffSwitchDriver has been initialized');
  }

}

module.exports = VimarOnOffSwitchDriver;
