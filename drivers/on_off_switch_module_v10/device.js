'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');
const { CLUSTER, BoundCluster } = require('zigbee-clusters');

// The module exposes a single functional endpoint that holds both the
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

class VimarOnOffSwitchModule extends ZigBeeDevice {

  async onNodeInit({ zclNode }) {
    // this.enableDebug();
    // this.printNode();

    this.registerCapability('onoff', CLUSTER.ON_OFF, {
      endpoint: ENDPOINT,
    });

    zclNode.endpoints[ENDPOINT].bind('onOff', new OnOffBoundCluster(this));

    // Configured explicitly (not via reportOpts, which only runs on the first init
    // after pairing) so that devices paired before this change get it too.
    if (!this.getStoreValue('reportingConfigured')) {
      this.configureAttributeReporting([{
        endpointId: ENDPOINT,
        cluster: CLUSTER.ON_OFF,
        attributeName: 'onOff',
        minInterval: 0,
        maxInterval: 300,
      }])
        .then(() => this.setStoreValue('reportingConfigured', true))
        .catch(err => this.error('configureAttributeReporting failed', err));
    }
  }

  onDeleted() {
    this.log('VimarOnOffSwitchModule removed');
  }

}

module.exports = VimarOnOffSwitchModule;
