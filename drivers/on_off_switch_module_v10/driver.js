'use strict';

const { ZigBeeDriver } = require('homey-zigbeedriver');

class VimarOnOffSwitchModuleDriver extends ZigBeeDriver {

  async onInit() {
    this.log('VimarOnOffSwitchModuleDriver has been initialized');
  }

}

module.exports = VimarOnOffSwitchModuleDriver;
