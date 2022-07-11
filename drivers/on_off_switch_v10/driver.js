'use strict';

const { Driver } = require('homey');

class MyDriver extends Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('MyDriver has been initialized');
  }

  /**
   * onPairListDevices is called when a user is adding a device
   * and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {
    return [
    //   Example device data, note that `store` is optional
       {
         name: 'Vimar On Off Switch',
         data: {
           id: 'On_Off_Switch_v1.0',
         },
       },
    ];
  }

}

module.exports = MyDriver;
