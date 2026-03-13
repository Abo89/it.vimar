'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');
const { CLUSTER } = require('zigbee-clusters');

const TEMP_FACTOR    = 0.01;
const THERMOSTAT_EP  = 10;
const POLL_INTERVAL  = 30000; // 30 sec – fallback garantito

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
    this.log('[Thermostat] onNodeInit');
    this.printNode();

    const cluster = zclNode.endpoints[THERMOSTAT_EP].clusters.thermostat;

    // ── 1. BIND esplicito ────────────────────────────────────────────────
    try {
      await cluster.bind();
      this.log('[Thermostat] bind OK');
    } catch (err) {
      this.error('[Thermostat] bind failed:', err.message);
    }

    // ── 2. CONFIGURE REPORTING diretto sul device ────────────────────────
    try {
      await cluster.configureReporting({
        localTemperature: {
          minInterval: 30,
          maxInterval: 300,
          minChange:   10,
        },
        occupiedHeatingSetpoint: {
          minInterval: 5,
          maxInterval: 300,
          minChange:   25,
        },
        systemMode: {
          minInterval: 5,
          maxInterval: 300,
          minChange:   1,
        },
      });
      this.log('[Thermostat] configureReporting OK');
    } catch (err) {
      this.error('[Thermostat] configureReporting failed (non-fatal):', err.message);
    }

    // ── 3. LISTENER DIRETTI sugli attributi del cluster ──────────────────
    cluster.on('attr.localTemperature', (value) => {
      const temp = parseFloat((value * TEMP_FACTOR).toFixed(2));
      this.log(`[attr] localTemperature → ${temp} °C`);
      this.setCapabilityValue('measure_temperature', temp).catch(this.error);
    });

    cluster.on('attr.occupiedHeatingSetpoint', (value) => {
      const temp = parseFloat((value * TEMP_FACTOR).toFixed(2));
      this.log(`[attr] occupiedHeatingSetpoint → ${temp} °C`);
      this.setCapabilityValue('target_temperature', temp).catch(this.error);
    });

    cluster.on('attr.systemMode', (value) => {
      const mode = ZIGBEE_MODE_TO_HOMEY[value] ?? 'off';
      this.log(`[attr] systemMode "${value}" → "${mode}"`);
      this.setCapabilityValue('thermostat_mode', mode).catch(this.error);
    });

    // ── 4. Lettura iniziale dei valori ───────────────────────────────────
    await this._pollValues(cluster);

    // ── 5. POLL LOOP manuale – fallback se i report non arrivano ─────────
    this._pollTimer = this.homey.setInterval(async () => {
      this.log('[Thermostat] polling...');
      await this._pollValues(cluster);
    }, POLL_INTERVAL);

    // ── 6. SCRITTURA target_temperature ──────────────────────────────────
    this.registerCapabilityListener('target_temperature', async (value) => {
      const raw = Math.round(value / TEMP_FACTOR);
      this.log(`[set] target_temperature ${value} °C → raw ${raw}`);
      try {
        await cluster.writeAttributes({ occupiedHeatingSetpoint: raw });
      } catch (err) {
        this.error('[set] target_temperature failed:', err);
        throw err;
      }
    });

    // ── 7. SCRITTURA thermostat_mode ──────────────────────────────────────
    this.registerCapabilityListener('thermostat_mode', async (value) => {
      const systemMode = HOMEY_MODE_TO_ZIGBEE[value] ?? 'off';
      this.log(`[set] thermostat_mode "${value}" → "${systemMode}"`);
      try {
        await cluster.writeAttributes({ systemMode });
      } catch (err) {
        this.error('[set] thermostat_mode failed:', err);
        throw err;
      }
    });
  }

  /**
   * Legge i tre attributi direttamente dal device e aggiorna le capability.
   */
  async _pollValues(cluster) {
    try {
      const {
        localTemperature,
        occupiedHeatingSetpoint,
        systemMode,
      } = await cluster.readAttributes([
        'localTemperature',
        'occupiedHeatingSetpoint',
        'systemMode',
      ]);

      if (localTemperature !== undefined) {
        const temp = parseFloat((localTemperature * TEMP_FACTOR).toFixed(2));
        this.log(`[poll] localTemperature → ${temp} °C`);
        await this.setCapabilityValue('measure_temperature', temp);
      }

      if (occupiedHeatingSetpoint !== undefined) {
        const temp = parseFloat((occupiedHeatingSetpoint * TEMP_FACTOR).toFixed(2));
        this.log(`[poll] occupiedHeatingSetpoint → ${temp} °C`);
        await this.setCapabilityValue('target_temperature', temp);
      }

      if (systemMode !== undefined) {
        const mode = ZIGBEE_MODE_TO_HOMEY[systemMode] ?? 'off';
        this.log(`[poll] systemMode "${systemMode}" → "${mode}"`);
        await this.setCapabilityValue('thermostat_mode', mode);
      }
    } catch (err) {
      this.error('[poll] readAttributes failed:', err.message);
    }
  }

  onDeleted() {
    if (this._pollTimer) {
      this.homey.clearInterval(this._pollTimer);
    }
  }

  async onEndDeviceAnnounce() {
    this.log('[Thermostat] device announced – polling now');
    const cluster = this.zclNode?.endpoints[THERMOSTAT_EP]?.clusters?.thermostat;
    if (cluster) await this._pollValues(cluster);
  }

}

module.exports = WheelThermostatDevice;
