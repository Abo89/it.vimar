'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');
const { CLUSTER, BoundCluster } = require('zigbee-clusters');

// The switch exposes a single functional endpoint that holds both the
// controllable relay (onOff input cluster) and the physical button
// (onOff output cluster). Endpoint 242 is Green Power and is ignored.
const ENDPOINT = 10;

// Receives onOff commands sent by the physical button (ep10 output cluster → Homey).
// This gives instant UI feedback on a wall-switch press, instead of waiting for
// the next attribute report from the relay.
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

class VimarOnOffSwitch extends ZigBeeDevice {

  async onNodeInit({ zclNode }) {
    // this.enableDebug();
    // this.printNode();

    this.registerCapability('onoff', CLUSTER.ON_OFF, {
      endpoint: ENDPOINT,
    });

    zclNode.endpoints[ENDPOINT].bind('onOff', new OnOffBoundCluster(this));
  }

  onDeleted() {
    this.log('VimarOnOffSwitch removed');
  }

}

module.exports = VimarOnOffSwitch;
