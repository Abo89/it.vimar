'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');
const { CLUSTER} = require('zigbee-clusters');

class Mains_Power_Outlet_v1_0 extends ZigBeeDevice {

  async onNodeInit({ zclNode }) {
    //this.enableDebug(); // only for debugging purposes
    //this.printNode(); // only for debugging purposes
    this.registerCapability('onoff', CLUSTER.ON_OFF);
        
    this.registerCapability('measure_power', CLUSTER.ELECTRICAL_MEASUREMENT, {        
        reportParser(value) {            
            if (value < 0) return null;
            return value;            
        },
        getOpts: {
          getOnStart: true,
          pollInterval: 10000
        }
    });
  }  

};

module.exports = Mains_Power_Outlet_v1_0;