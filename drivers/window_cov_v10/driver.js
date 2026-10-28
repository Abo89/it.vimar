'use strict';

const { ZigBeeDriver } = require('homey-zigbeedriver');

class WindowCovV10Driver extends ZigBeeDriver {

    async onInit() {
        this.log('Vimar window covering driver has been initialized');

        // Flow actions defined in app.json (move_open / move_close).
        // Drive the blind to its end-stops via the windowcoverings_state capability,
        // which sends the standard ZCL upOpen / downClose commands.
        this.homey.flow
            .getActionCard('move_open')
            .registerRunListener(async ({ device }) => this._move(device, 'up'));

        this.homey.flow
            .getActionCard('move_close')
            .registerRunListener(async ({ device }) => this._move(device, 'down'));
    }

    async _move(device, direction) {
        await device.triggerCapabilityListener('windowcoverings_state', direction);
        // triggerCapabilityListener only runs the listener; keep the UI in sync.
        await device.setCapabilityValue('windowcoverings_state', direction).catch(device.error);
    }

}

module.exports = WindowCovV10Driver;
