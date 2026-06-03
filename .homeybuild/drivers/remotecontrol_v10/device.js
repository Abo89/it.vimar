'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');
const { BoundCluster } = require('zigbee-clusters');

const ENDPOINT_BUTTON = 10;

/**
 * Vimar wireless remote control (modelId "RemoteControl_v1.0").
 *
 * This device has no load of its own: endpoint 10 only exposes *output* clusters
 * (onOff 6, levelControl 8, windowCovering 258, identify 3). It acts as a Zigbee
 * controller that sends commands to bound targets. We bind those clusters to Homey
 * so the commands are delivered here, and turn every received command into a single
 * "remote_button_pressed" flow trigger whose `action` argument selects the command.
 */

// onOff commands sent by the remote (ep10 output cluster → Homey).
class OnOffBoundCluster extends BoundCluster {
  constructor({ onCommand }) {
    super();
    this._onCommand = onCommand;
  }

  setOn() { this._onCommand('on'); }
  setOff() { this._onCommand('off'); }
  toggle() { this._onCommand('toggle'); }
}

// levelControl commands sent by the remote (hold-to-dim and step).
// Both the plain and *WithOnOff variants are mapped to the same actions.
class LevelControlBoundCluster extends BoundCluster {
  constructor({ onCommand }) {
    super();
    this._onCommand = onCommand;
  }

  move({ moveMode }) { this._onCommand(moveMode === 'up' ? 'dim_up' : 'dim_down'); }
  moveWithOnOff({ moveMode }) { this._onCommand(moveMode === 'up' ? 'dim_up' : 'dim_down'); }
  step({ mode }) { this._onCommand(mode === 'up' ? 'dim_up' : 'dim_down'); }
  stepWithOnOff({ mode }) { this._onCommand(mode === 'up' ? 'dim_up' : 'dim_down'); }
  stop() { this._onCommand('dim_stop'); }
  stopWithOnOff() { this._onCommand('dim_stop'); }
}

// windowCovering commands sent by the remote (blind/shutter buttons).
class WindowCoveringBoundCluster extends BoundCluster {
  constructor({ onCommand }) {
    super();
    this._onCommand = onCommand;
  }

  upOpen() { this._onCommand('open'); }
  downClose() { this._onCommand('close'); }
  stop() { this._onCommand('cover_stop'); }
}

class RemoteControlV10Device extends ZigBeeDevice {

  async onNodeInit({ zclNode }) {
    await super.onNodeInit({ zclNode });

    if (process.env.DEBUG === '1') this.printNode();

    // The driver registers and owns the flow card; the device only triggers it.
    this._triggerCard = this.homey.flow.getDeviceTriggerCard('remote_button_pressed');

    const onCommand = action => {
      this.log('remote command received:', action);
      this._triggerCard
        .trigger(this, {}, { action })
        .catch(err => this.error('failed to trigger remote_button_pressed', err));
    };

    const endpoint = zclNode.endpoints[ENDPOINT_BUTTON];
    endpoint.bind('onOff', new OnOffBoundCluster({ onCommand }));
    endpoint.bind('levelControl', new LevelControlBoundCluster({ onCommand }));
    endpoint.bind('windowCovering', new WindowCoveringBoundCluster({ onCommand }));
  }

  onDeleted() {
    this.log('Vimar remote control removed');
  }

}

module.exports = RemoteControlV10Device;
