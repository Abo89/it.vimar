'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');
const { CLUSTER } = require('zigbee-clusters');

// Zigbee represents temperatures in units of 0.01 °C
const TEMP_FACTOR = 0.01;

/**
 * Maps Zigbee thermostat systemMode values → Homey thermostat_mode capability values.
 * The Vimar WheelThermostat is a heating-only device
 * (controlSequenceOfOperation = "heating"), but we map all possible values.
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

/**
 * Vimar WheelThermostat_v1.0
 *
 * Zigbee interview data
 *  - modelId:           WheelThermostat_v1.0
 *  - manufacturerName:  Vimar
 *  - endpoint 10        inputClusters: [0 basic, 3 identify, 513 thermostat]
 *  - powerSource:       mains (always on / receiveWhenIdle = true)
 *
 * Thermostat cluster attributes used:
 *  - localTemperature          (0x0000) read-only   → measure_temperature
 *  - occupiedHeatingSetpoint   (0x0012) read/write  → target_temperature
 *  - systemMode                (0x001C) read/write  → thermostat_mode
 *
 * Setpoint limits from device descriptor:
 *  - minHeatSetpointLimit: 500  (5.00 °C)
 *  - maxHeatSetpointLimit: 3900 (39.00 °C)
 */
class WheelThermostatDevice extends ZigBeeDevice {

  async onNodeInit({ zclNode }) {
    this.log('[WheelThermostatDevice] onNodeInit');
    this.printNode();

    // ── measure_temperature ───────────────────────────────────────────────
    this.registerCapability('measure_temperature', CLUSTER.THERMOSTAT, {
      get:        'localTemperature',
      getOpts: {
        getOnStart: true,
        pollInterval: this.minReportInterval || 300000, // fallback 5 min
      },
      report:     'localTemperature',
      reportParser: value => {
        const temp = parseFloat((value * TEMP_FACTOR).toFixed(2));
        this.log(`[measure_temperature] ${value} → ${temp} °C`);
        return temp;
      },
      reportOpts: {
        configureAttributeReporting: {
          minInterval:  30,   // 30 seconds
          maxInterval:  600,  // 10 minutes
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
      setParser: value => {
        const raw = Math.round(value / TEMP_FACTOR);
        this.log(`[target_temperature] set ${value} °C → ${raw}`);
        return { occupiedHeatingSetpoint: raw };
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
      setParser: value => {
        const systemMode = HOMEY_MODE_TO_ZIGBEE[value] ?? 'off';
        this.log(`[thermostat_mode] set "${value}" → systemMode "${systemMode}"`);
        return { systemMode };
      },
    });
  }

  // ── Called when the device re-announces itself on the network ────────────
  async onEndDeviceAnnounce() {
    this.log('[WheelThermostatDevice] device announced – refreshing attributes');
    try {
      await this.onNodeInit({ zclNode: this.zclNode });
    } catch (err) {
      this.error('[WheelThermostatDevice] refresh after announce failed:', err);
    }
  }

}

module.exports = WheelThermostatDevice;

