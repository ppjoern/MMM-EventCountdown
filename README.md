# MMM-EventCountdown

## Screenshot
![Screenshot](https://github.com/ppjoern/MMM-EventCountdown/screenshots/Screenshot_start_5r_green.png)

![Screenshot](https://github.com/ppjoern/MMM-EventCountdown/screenshots/Screenshot_start_r5_yellow.png)

![Screenshot](https://github.com/ppjoern/MMM-EventCountdown/blob/master/screenshots/Screenshot_start_r5_orange.png)

![Screenshot](https://github.com/ppjoern/MMM-EventCountdown/blob/master/screenshots/Screenshot_start_r4_red.png)

![Screenshot](https://github.com/ppjoern/MMM-EventCountdown/blob/master/screenshots/Screenshot_start_r3_red.png)

![Screenshot](https://github.com/ppjoern/MMM-EventCountdown/blob/master/screenshots/Screenshot_start_r2_red.png)

![Screenshot](https://github.com/ppjoern/MMM-EventCountdown/blob/master/screenshots/Screenshot_start_r1_red.png)

![Screenshot](https://github.com/ppjoern/MMM-EventCountdown/blob/master/screenshots/Screenshot_running_g5.png)

## Description

This is a module for [MagicMirror²](https://github.com/MichMich/MagicMirror/) which counts down to the next calendar event. 

This module requests an event list from [MMM-CalExt2](https://github.com/MMM-CalendarExt2/MMM-CalendarExt2) for the current date, and displays a countdown in days, hours, minutes and seconds to the next event.

This module is based on MMM-NextEvent.

## Installation

```
cd ~/MagicMirror/modules
git clone https://github.com/ppjoern/MMM-EventCountdown
```

## Configuration

To use this module, add the following configuration block to the modules array in the `config/config.js` file:

```js
var config = {
    modules: [
        {
            module: 'MMM-EventCountdown',
            config: {
                // See configuration options
            }
        }
    ]
}
```

example configuration for MMM-CalendarExt2
```js
{
    module: 'MMM-CalendarExt2',
    config: {
    defaultSet: {
    },
    calendars : [
        {
        name: "Events for Countdown",
        // Google Calendar
        url: "https://calendar.google.com/calendar/ical/.........ics",
        scanInterval: 1000 * 60 * 1, //Refresh every minute
        },
    ],
    views: [
        {
        },
    ],
    scenes: [
        {
        name: "PAGE1",
        className: "fakeScene"
        },
    ],
  },
},
```

### Configuration options

| Option           | Description                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| `position`       | *Required* Where do you want to place the EventCountdown (use standard magicmirror positions) only tested with "middle_center"|
| `showDays`        | Decide whether or not to display the days. Default is true|
| `showLights`      | Decide whether or not to display the lights. Default is true|
| `customInterval`  | Change the update interval. Default is 1000 |
| `daysLabel`       | Choose how you wish to display your Days label. Default is 'DAYS'|
| `hoursLabel`      | Choose how you wish to display your Hours label. Default is 'HOURS'|
| `minutesLabel`    | Choose how you wish to display your Minutes label. Default is 'MINUTES'|
| `secondsLabel`    | Choose how you wish to display your Seconds label. Default is 'SECONDS'|
