## Nefit Easy™ client library

Node.js client library for the [Nefit Easy](http://www.nefit.nl/consument/service/easy/easy) smart thermostat.

Work in progress!

### Installation

``` javascript
$ git clone https://github.com/robertklep/nefit-easy-client
$ cd nefit-easy-client
$ npm install
```

### Demo

There's an example script provided that will show temperatures (current, set and outside) and system pressure.

You need to provide the following information before the client can connect to the backend:

* The Easy serial number, which can be found on the manual that was supplied with the device;
* The access key (a 16-character code, also on the manual);
* The application password (set the first time you run the iOS/Android app);

The example script will read these values from environment variables.

``` javascript
$ export NEFIT_SERIAL_NUMBER=...
$ export NEFIT_ACCESS_KEY=...
$ export NEFIT_PASSWORD=...
$ node example/current-status.js
Temperature is set to 16.8°C, current is 16.5°C.
Outside temperature is 10°C.
System pressure is 1.4 bar.
```

### Synopsis

The Nefit Easy™ smart thermostat is sold in The Netherlands by [Nefit](http://www.welkombijnefit.nl/nl), a company owned by [Robert Bosch GmbH](http://www.bosch.com/).

The Easy can be controlled through apps for Android and iOS, which communicate with a Bosch-hosted backend using the [XMPP](https://en.wikipedia.org/wiki/XMPP) protocol. This library aims to implement the communication protocol used between the apps and the backend.

### Disclaimer

The implementation of this library is based on reverse-engineering the communications between the apps and the backend, plus various other bits and pieces of information. It is _not_ based on any official information given out by Nefit/Bosch, and therefore there are no guarantees whatsoever regarding the safety of your devices and/or its settings.
