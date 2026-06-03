'use strict';

const { ZigBeeDriver } = require('homey-zigbeedriver');

class RemoteControlV10Driver extends ZigBeeDriver {

  async onInit() {
    this.log('Vimar remote control driver has been initialized');

    // Single trigger card (defined in driver.flow.compose.json) with an `action`
    // dropdown. The device fires it with state.action; here we only let the flow
    // run when the selected argument matches the command that was received.
    this.homey.flow
      .getDeviceTriggerCard('remote_button_pressed')
      .registerRunListener((args, state) => args.action === state.action);
  }

}

module.exports = RemoteControlV10Driver;
