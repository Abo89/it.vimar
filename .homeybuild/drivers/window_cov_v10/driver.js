'use strict';

const { ZigBeeDriver } = require('homey-zigbeedriver');

class WindowCovV10Driver extends ZigBeeDriver {

    async onInit() {
        this.log('Vimar window covering driver has been initialized');

        // Flow actions defined in driver.flow.compose.json.
        // Drive the blind to its end-stops via the windowcoverings_state capability,
        // which sends the standard ZCL upOpen / downClose commands.
        this.homey.flow
            .getActionCard('move_open')
            .registerRunListener(async ({ device }) => device.triggerCapabilityListener('windowcoverings_state', 'up'));

        this.homey.flow
            .getActionCard('move_close')
            .registerRunListener(async ({ device }) => device.triggerCapabilityListener('windowcoverings_state', 'down'));
    }

}

module.exports = WindowCovV10Driver;
