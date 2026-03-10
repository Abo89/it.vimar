'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');
const { CLUSTER } = require('zigbee-clusters');

// Zigbee represents temperatures in units of 0.01 °C
const TEMP_FACTOR = 0.01;

/**
 * Maps Zigbee thermostat systemMode values → Homey thermostat_mode capability values.
 */
const ZIGBEE_MODE_TO_HOMEY = {
  off:                  'off',
  heat:                 'heat',
  cool:                 'cool',
  auto:                 'auto',
  'emergency heating':  'heat',
  precooling:           'cool',
  'fan only':           'off',
  dry:                  'off',
  sleep:                'off',
};

const HOMEY_MODE_TO_ZIGBEE = {
  off:  'off',
  heat: 'heat',
  cool: 'cool',
  auto: 'auto',
};

class WheelThermostatDevice extends ZigBeeDevice {

  async onNodeInit({ zclNode }) {
    this.log('[WheelThermostatDevice] onNodeInit');
    this.printNode();

    // ── measure_temperature ───────────────────────────────────────────────
    this.registerCapability('measure_temperature', CLUSTER.THERMOSTAT, {
      get:        'localTemperature',
      getOpts: {
        getOnStart: true,
        pollInterval: this.minReportInterval || 300000,
      },
      report:     'localTemperature',
      reportParser: value => {
        const temp = parseFloat((value * TEMP_FACTOR).toFixed(2));
        this.log(`[measure_temperature] ${value} → ${temp} °C`);
        return temp;
      },
      reportOpts: {
        configureAttributeReporting: {
          minInterval:  30,
          maxInterval:  600,
          minChange:    10,   // 0.10 °C
        },
      },
    });

    // ── target_temperature ────────────────────────────────────────────────
    this.registerCapability('target_temperature', CLUSTER.THERMOSTAT, {
      get:        'occupiedHeatingSetpoint',
      getOpts: {
        getOnStart: true,
      },
      report:     'occupiedHeatingSetpoint',
      reportParser: value => {
        const temp = parseFloat((value * TEMP_FACTOR).toFixed(2));
        this.log(`[target_temperature] get ${value} → ${temp} °C`);
        return temp;
      },
      reportOpts: {
        configureAttributeReporting: {
          minInterval: 10,
          maxInterval: 600,
          minChange:   50,  // 0.50 °C
        },
      },
      set:       'occupiedHeatingSetpoint',
      // ✅ FIX: restituire il valore grezzo, NON un oggetto { attributeName: value }
      setParser: value => {
        const raw = Math.round(value / TEMP_FACTOR);
        this.log(`[target_temperature] set ${value} °C → ${raw}`);
        return raw;
      },
    });

    // ── thermostat_mode ───────────────────────────────────────────────────
    this.registerCapability('thermostat_mode', CLUSTER.THERMOSTAT, {
      get:        'systemMode',
      getOpts: {
        getOnStart: true,
      },
      report:     'systemMode',
      reportParser: value => {
        const mode = ZIGBEE_MODE_TO_HOMEY[value] ?? 'off';
        this.log(`[thermostat_mode] get "${value}" → "${mode}"`);
        return mode;
      },
      reportOpts: {
        configureAttributeReporting: {
          minInterval: 10,
          maxInterval: 600,
          minChange:   1,
        },
      },
      set:       'systemMode',
      // ✅ FIX: restituire la stringa del modo, NON un oggetto { systemMode }
      setParser: value => {
        const systemMode = HOMEY_MODE_TO_ZIGBEE[value] ?? 'off';
        this.log(`[thermostat_mode] set "${value}" → systemMode "${systemMode}"`);
        return systemMode;
      },
    });
  }

  // ── Called when the device re-announces itself on the network ────────────
  async onEndDeviceAnnounce() {
    this.log('[WheelThermostatDevice] device announced – refreshing attributes');
    try {
      await this.refreshCapabilityValues();
    } catch (err) {
      this.error('[WheelThermostatDevice] refresh after announce failed:', err);
    }
  }

}

module.exports = WheelThermostatDevice;
