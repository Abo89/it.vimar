'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');
const { CLUSTER } = require('zigbee-clusters');

// Zigbee represents temperatures in units of 0.01 °C
const TEMP_FACTOR = 0.01;

// Endpoint del termostato Vimar WheelThermostat
const THERMOSTAT_ENDPOINT = 10;

/**
 * Maps Zigbee thermostat systemMode values → Homey thermostat_mode capability values.
 * Questo dispositivo supporta solo heating (controlSequenceOfOperation = "heating")
 */
const ZIGBEE_MODE_TO_HOMEY = {
  off:                 'off',
  heat:                'heat',
  cool:                'cool',
  auto:                'auto',
  'emergency heating': 'heat',
  precooling:          'cool',
  'fan only':          'off',
  dry:                 'off',
  sleep:               'off',
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

    const thermostatCluster = zclNode.endpoints[THERMOSTAT_ENDPOINT].clusters.thermostat;

    // ── measure_temperature (sola lettura) ────────────────────────────────
    this.registerCapability('measure_temperature', CLUSTER.THERMOSTAT, {
      endpoint: THERMOSTAT_ENDPOINT,
      get:      'localTemperature',
      getOpts: {
        getOnStart:   true,
        pollInterval: this.minReportInterval || 300000,
      },
      report:       'localTemperature',
      reportParser: value => {
        const temp = parseFloat((value * TEMP_FACTOR).toFixed(2));
        this.log(`[measure_temperature] ${value} → ${temp} °C`);
        return temp;
      },
      reportOpts: {
        configureAttributeReporting: {
          minInterval: 30,
          maxInterval: 600,
          minChange:   10,   // 0.10 °C
        },
      },
    });

    // ── target_temperature: lettura ───────────────────────────────────────
    this.registerCapability('target_temperature', CLUSTER.THERMOSTAT, {
      endpoint: THERMOSTAT_ENDPOINT,
      get:      'occupiedHeatingSetpoint',
      getOpts: {
        getOnStart: true,
      },
      report:       'occupiedHeatingSetpoint',
      reportParser: value => {
        const temp = parseFloat((value * TEMP_FACTOR).toFixed(2));
        this.log(`[target_temperature] report ${value} → ${temp} °C`);
        return temp;
      },
      reportOpts: {
        configureAttributeReporting: {
          minInterval: 10,
          maxInterval: 600,
          minChange:   50,   // 0.50 °C
        },
      },
    });

    // ── target_temperature: scrittura (FIX – writeAttributes diretto) ─────
    this.registerCapabilityListener('target_temperature', async (value) => {
      const raw = Math.round(value / TEMP_FACTOR);
      this.log(`[target_temperature] set ${value} °C → raw ${raw}`);
      try {
        await thermostatCluster.writeAttributes({ occupiedHeatingSetpoint: raw });
        this.log(`[target_temperature] writeAttributes OK`);
      } catch (err) {
        this.error('[target_temperature] writeAttributes failed:', err);
        throw err;
      }
    });

    // ── thermostat_mode: lettura ──────────────────────────────────────────
    this.registerCapability('thermostat_mode', CLUSTER.THERMOSTAT, {
      endpoint: THERMOSTAT_ENDPOINT,
      get:      'systemMode',
      getOpts: {
        getOnStart: true,
      },
      report:       'systemMode',
      reportParser: value => {
        const mode = ZIGBEE_MODE_TO_HOMEY[value] ?? 'off';
        this.log(`[thermostat_mode] report "${value}" → "${mode}"`);
        return mode;
      },
      reportOpts: {
        configureAttributeReporting: {
          minInterval: 10,
          maxInterval: 600,
          // minChange omesso: systemMode è un enum, non numerico
        },
      },
    });

    // ── thermostat_mode: scrittura (FIX – writeAttributes diretto) ────────
    this.registerCapabilityListener('thermostat_mode', async (value) => {
      const systemMode = HOMEY_MODE_TO_ZIGBEE[value] ?? 'off';
      this.log(`[thermostat_mode] set "${value}" → systemMode "${systemMode}"`);
      try {
        await thermostatCluster.writeAttributes({ systemMode });
        this.log(`[thermostat_mode] writeAttributes OK`);
      } catch (err) {
        this.error('[thermostat_mode] writeAttributes failed:', err);
        throw err;
      }
    });
  }

  // ── Ri-annuncio sul network: aggiorna tutti i valori ────────────────────
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
