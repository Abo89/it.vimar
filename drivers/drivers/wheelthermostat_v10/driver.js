'use strict';

const { ZigBeeDriver } = require('homey-zigbeedriver');

/**
 * Driver for Vimar WheelThermostat_v1.0
 * Zigbee Profile: HA (260) — Device ID: 769 (IAS Zone / Thermostat)
 * Endpoint 10: clusters basic(0), identify(3), thermostat(513/0x0201)
 */
class WheelThermostatDriver extends ZigBeeDriver {

  async onInit() {
    await super.onInit();
    this.log('[WheelThermostatDriver] initialized');
  }

}

module.exports = WheelThermostatDriver;

