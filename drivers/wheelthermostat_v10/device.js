'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');
const { CLUSTER } = require('zigbee-clusters');

// Zigbee represents temperatures in units of 0.01 °C
const TEMP_FACTOR = 0.01;

// Endpoint del termostato Vimar WheelThermostat
const THERMOSTAT_ENDPOINT = 10;

// Poll interval come fallback se i report Zigbee non arrivano (ms)
const POLL_INTERVAL = 60000; // 60 secondi

/**
 * Maps Zigbee thermostat systemMode values → Homey thermostat_mode capability values.
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

    // ── BIND esplicito del cluster thermostat ─────────────────────────────
    // Necessario perché i report Zigbee arrivino all'hub
    try {
      await zclNode.endpoints[THERMOSTAT_ENDPOINT].clusters.thermostat.bind();
      this.log('[WheelThermostatDevice] thermostat cluster bound OK');
    } catch (err) {
      this.error('[WheelThermostatDevice] thermostat bind failed (non-fatal):', err.message);
    }

    // ── measure_temperature (sola lettura) ────────────────────────────────
    this.registerCapability('measure_temperature', CLUSTER.THERMOSTAT, {
      endpoint: THERMOSTAT_ENDPOINT,
      get:      'localTemperature',
      getOpts: {
        getOnStart:   true,
        pollInterval: POLL_INTERVAL,   // FIX: fallback polling
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
          maxInterval: 300,
          minChange:   5,    // FIX: era 10 (=0.10 °C), ora 5 (=0.05 °C) più reattivo
        },
      },
    });

    // ── target_temperature: lettura + polling ─────────────────────────────
    this.registerCapability('target_temperature', CLUSTER.THERMOSTAT, {
      endpoint: THERMOSTAT_ENDPOINT,
      get:      'occupiedHeatingSetpoint',
      getOpts: {
        getOnStart:   true,
        pollInterval: POLL_INTERVAL,   // FIX: aggiunto polling fallback
      },
      report:       'occupiedHeatingSetpoint',
      reportParser: value => {
        const temp = parseFloat((value * TEMP_FACTOR).toFixed(2));
        this.log(`[target_temperature] report ${value} → ${temp} °C`);
        return temp;
      },
      reportOpts: {
        configureAttributeReporting: {
          minInterval: 5,
          maxInterval: 300,
          minChange:   25,   // FIX: era 50 (=0.50 °C), ora 25 (=0.25 °C)
        },
      },
    });

    // ── target_temperature: scrittura ─────────────────────────────────────
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

    // ── thermostat_mode: lettura + polling ────────────────────────────────
    this.registerCapability('thermostat_mode', CLUSTER.THERMOSTAT, {
      endpoint: THERMOSTAT_ENDPOINT,
      get:      'systemMode',
      getOpts: {
        getOnStart:   true,
        pollInterval: POLL_INTERVAL,   // FIX: aggiunto polling fallback
      },
      report:       'systemMode',
      reportParser: value => {
        const mode = ZIGBEE_MODE_TO_HOMEY[value] ?? 'off';
        this.log(`[thermostat_mode] report "${value}" → "${mode}"`);
        return mode;
      },
      reportOpts: {
        configureAttributeReporting: {
          minInterval: 5,
          maxInterval: 300,
          // minChange omesso: systemMode è un enum
        },
      },
    });

    // ── thermostat_mode: scrittura ────────────────────────────────────────
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

    // ── Configura attribute reporting manualmente come conferma ───────────
    // Alcuni device ignorano la configurazione via registerCapability
    this._configureReporting(thermostatCluster).catch(err =>
      this.error('[WheelThermostatDevice] manual configureReporting failed:', err.message),
    );
  }

  /**
   * Configura attribute reporting direttamente sul cluster.
   * Fallback nel caso in cui registerCapability non lo faccia correttamente.
   */
  async _configureReporting(thermostatCluster) {
    await thermostatCluster.configureReporting({
      localTemperature: {
        minInterval: 30,
        maxInterval: 300,
        minChange:   5,
      },
      occupiedHeatingSetpoint: {
        minInterval: 5,
        maxInterval: 300,
        minChange:   25,
      },
      systemMode: {
        minInterval: 5,
        maxInterval: 300,
        minChange:   0,
      },
    });
    this.log('[WheelThermostatDevice] configureReporting OK');
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
