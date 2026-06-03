'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');

// The thermostat cluster reports temperatures/setpoints in 0.01 °C units (int16).
const TEMP_FACTOR   = 0.01;
const THERMOSTAT_EP = 10;
// Fallback poll: the device does not always emit attribute reports reliably,
// mirroring the pattern used by the other Vimar drivers in this app.
const POLL_INTERVAL = 30000; // 30 s

// zigbee-clusters systemMode enum keys → Homey thermostat_mode values.
// Note the camelCase keys (`emergencyHeating`, `fanOnly`) – these are the
// exact strings emitted by the cluster's enum8 parser.
const ZIGBEE_MODE_TO_HOMEY = {
  off:              'off',
  auto:             'auto',
  cool:             'cool',
  heat:             'heat',
  emergencyHeating: 'heat',
  precooling:       'cool',
  fanOnly:          'off',
  dry:              'off',
  sleep:            'off',
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

    this._cluster = zclNode.endpoints[THERMOSTAT_EP].clusters.thermostat;

    // ── 1. Bind the thermostat cluster so the device may push reports ─────
    try {
      await this._cluster.bind();
      this.log('[Thermostat] bind OK');
    } catch (err) {
      this.error('[Thermostat] bind failed:', err.message);
    }

    // ── 2. Configure attribute reporting (best-effort) ───────────────────
    try {
      await this._cluster.configureReporting({
        localTemperature: {
          minInterval: 30, maxInterval: 300, minChange: 10, // 0.1 °C
        },
        occupiedHeatingSetpoint: {
          minInterval: 5, maxInterval: 300, minChange: 25, // 0.25 °C
        },
        systemMode: {
          minInterval: 5, maxInterval: 300, minChange: 1,
        },
      });
      this.log('[Thermostat] configureReporting OK');
    } catch (err) {
      this.error('[Thermostat] configureReporting failed (non-fatal):', err.message);
    }

    // ── 3. Attribute report listeners ────────────────────────────────────
    this._cluster.on('attr.localTemperature', (value) => {
      this._setMeasuredTemperature(value);
    });
    this._cluster.on('attr.occupiedHeatingSetpoint', (value) => {
      this._setTargetTemperature(value);
    });
    this._cluster.on('attr.systemMode', (value) => {
      this._setSystemMode(value);
    });

    // ── 4. Capability write listeners (heating-only) ─────────────────────
    this.registerCapabilityListener('target_temperature', async (value) => {
      const raw = Math.round(value / TEMP_FACTOR);
      this.log(`[set] target_temperature ${value} °C → occupiedHeatingSetpoint=${raw}`);
      await this._cluster.writeAttributes({ occupiedHeatingSetpoint: raw });
    });

    this.registerCapabilityListener('thermostat_mode', async (value) => {
      const systemMode = HOMEY_MODE_TO_ZIGBEE[value] ?? 'off';
      this.log(`[set] thermostat_mode "${value}" → "${systemMode}"`);
      await this._cluster.writeAttributes({ systemMode });
    });

    // ── 5. Initial read + polling fallback ───────────────────────────────
    await this._poll();
    this._pollTimer = this.homey.setInterval(() => this._poll(), POLL_INTERVAL);
  }

  _setMeasuredTemperature(value) {
    if (value === null || value === undefined) return;
    const temp = parseFloat((value * TEMP_FACTOR).toFixed(2));
    this.setCapabilityValue('measure_temperature', temp).catch(this.error);
  }

  _setTargetTemperature(value) {
    if (value === null || value === undefined) return;
    const temp = parseFloat((value * TEMP_FACTOR).toFixed(2));
    this.setCapabilityValue('target_temperature', temp).catch(this.error);
  }

  _setSystemMode(value) {
    const mode = ZIGBEE_MODE_TO_HOMEY[value] ?? 'off';
    this.log(`[attr] systemMode "${value}" → "${mode}"`);
    this.setCapabilityValue('thermostat_mode', mode).catch(this.error);
  }

  /** Reads the relevant attributes directly and refreshes all capabilities. */
  async _poll() {
    try {
      const {
        localTemperature,
        occupiedHeatingSetpoint,
        systemMode,
      } = await this._cluster.readAttributes([
        'localTemperature',
        'occupiedHeatingSetpoint',
        'systemMode',
      ]);

      this._setMeasuredTemperature(localTemperature);
      this._setTargetTemperature(occupiedHeatingSetpoint);
      if (systemMode !== undefined) this._setSystemMode(systemMode);
    } catch (err) {
      this.error('[poll] readAttributes failed:', err.message);
    }
  }

  async onEndDeviceAnnounce() {
    this.log('[Thermostat] device announced – polling now');
    if (this._cluster) await this._poll();
  }

  onDeleted() {
    if (this._pollTimer) this.homey.clearInterval(this._pollTimer);
  }

  onUninit() {
    if (this._pollTimer) this.homey.clearInterval(this._pollTimer);
  }

}

module.exports = WheelThermostatDevice;
