'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');
const { CLUSTER, BoundCluster } = require('zigbee-clusters');

const ENDPOINT_LOAD = 11;
const ENDPOINT_BUTTON = 10;

// Receives onOff commands sent by the physical button (ep10 output cluster → Homey).
class OnOffBoundCluster extends BoundCluster {
  constructor(device) {
    super();
    this._device = device;
  }

  setOn() {
    this._device.setCapabilityValue('onoff', true).catch(err =>
      this._device.error('BoundCluster setOn failed', err)
    );
  }

  setOff() {
    this._device.setCapabilityValue('onoff', false).catch(err =>
      this._device.error('BoundCluster setOff failed', err)
    );
  }

  toggle() {
    const current = this._device.getCapabilityValue('onoff');
    this._device.setCapabilityValue('onoff', !current).catch(err =>
      this._device.error('BoundCluster toggle failed', err)
    );
  }
}

// Receives levelControl commands sent by the physical button (ep10 output cluster → Homey).
// move/step/stop commands (hold-to-dim) are not tracked here because the final level is
// unknown until the button is released; ep11 attribute reports will reconcile the value.
class LevelControlBoundCluster extends BoundCluster {
  constructor(device) {
    super();
    this._device = device;
  }

  moveToLevel({ level }) {
    const dimValue = Math.min(Math.max(level / 254, 0), 1);
    this._device.setCapabilityValue('dim', dimValue).catch(err =>
      this._device.error('BoundCluster moveToLevel failed', err)
    );
  }

  moveToLevelWithOnOff({ level }) {
    const dimValue = Math.min(Math.max(level / 254, 0), 1);
    this._device.setCapabilityValue('dim', dimValue).catch(err =>
      this._device.error('BoundCluster moveToLevelWithOnOff (dim) failed', err)
    );
    this._device.setCapabilityValue('onoff', level > 0).catch(err =>
      this._device.error('BoundCluster moveToLevelWithOnOff (onoff) failed', err)
    );
  }
}

class VimarDimmerSwitch extends ZigBeeDevice {

  async onNodeInit({ zclNode }) {
    // this.enableDebug();
    // this.printNode();

    this.registerCapability('onoff', CLUSTER.ON_OFF, {
      endpoint: ENDPOINT_LOAD,
    });

    this.registerCapability('dim', CLUSTER.LEVEL_CONTROL, {
      endpoint: ENDPOINT_LOAD,
    });

    zclNode.endpoints[ENDPOINT_BUTTON].bind('onOff', new OnOffBoundCluster(this));
    zclNode.endpoints[ENDPOINT_BUTTON].bind('levelControl', new LevelControlBoundCluster(this));
  }

  onDeleted() {
    this.log('VimarDimmerSwitch removed');
  }

}

module.exports = VimarDimmerSwitch;
