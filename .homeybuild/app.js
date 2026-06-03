'use strict';

const Homey = require('homey');

class MyApp extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('Vimar IoT devices management');
    const myImage = await this.homey.images.createImage();
    myImage.setPath("/assets/images/Logo_Vimar_XLarge.png");
  }

}

module.exports = MyApp;
