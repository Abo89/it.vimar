# Changelog

## v1.4.9 - 2026-10-28
- window_cov_v10: add tilt capability to blinds paired before v1.4.3 and configure tilt reporting; round tilt commands and ignore invalid tilt reports
- window_cov_v10: Open/Close flow cards now update the blind state and have Italian titles
- wheelthermostat_v10: thermostat modes limited to off/heat (heating-only device); ignore invalid temperature readings
- mains_power_outlet_v10: correct fallback power scaling (x10); device class set to socket
- Dimmer, switches and outlet: configure attribute reporting so external changes show up immediately
- Outlet polling 10 s -> 60 s, thermostat polling 30 s -> 5 min
- Remove leftover template pairing code; Zigbee drivers use Homey's built-in Zigbee pairing

## v1.3.18 - 2026-06-02
- Replace all driver images with new PNG assets (1000x1000, 500x500, 75x75)
- Update Vimar logo images
- Fix typo in image path for dimmerswitch, on_off_switch, on_off_switch_module, window_cov drivers

## v1.3.17 - 2026-06-02
- Image update

## v1.3.16 - 2026-06-02
- Image update

## v1.3.15 - 2026-06-02
- Image update

## v1.3.14 - 2026-06-02
- Image update

## v1.3.13 - 2026-06-01
- Image update

## v1.3.12
- Image update

## v1.3.10
- Image update

## v1.3.9
- Image update

## v1.3.8
- Image update

## v1.3.7
- Image update

## v1.3.6
- Image update

## v1.3.5
- Update thermostat driver code

## v1.3.4
- Update thermostat driver code

## v1.3.3
- Code review on thermostat driver

## v1.3.2
- Fix thermostat driver code

## v1.3.1
- Code review

## v1.3.0
- Add WheelThermostat v1.0 driver

## v1.2.0
- General code review for all drivers

## v1.1.2
- Change on_off_switch from button class to light class

## v1.1.0
- Add On_Off_Switch_Module v1.0 driver

## v1.0.0
- Initial release: DimmerSwitch v1.0, On_Off_Switch v1.0
