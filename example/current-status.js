const Promise         = require('bluebird');
const NefitEasyClient = require('..');

// Instantiate client
const client = NefitEasyClient({
  serialNumber : process.env.NEFIT_SERIAL_NUMBER,
  accessKey    : process.env.NEFIT_ACCESS_KEY,
  password     : process.env.NEFIT_PASSWORD,
});

// Connect client and retrieve status and pressure.
client.connect().then( () => {
  return Promise.all([ client.status(), client.pressure() ]);
}).spread((status, pressure) => {
  console.log(
    'Temperature is set to %s°C, current is %s°C.\n' +
    'Outside temperature is %s°C.\n' +
    'System pressure is %s %s.',
    status['temp setpoint'].toFixed(1),
    status['in house temp'].toFixed(1),
    status['outdoor temp'].toFixed(1),
    pressure.pressure,
    pressure.unit
  );
}).catch((e) => {
  console.error('error', e)
}).finally(() => {
  client.end();
});
