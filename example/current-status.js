const Promise         = require('bluebird');
const NefitEasyClient = require('../lib');

// Instantiate client
const client = NefitEasyClient({
  serialNumber : process.env.NEFIT_SERIAL_NUMBER,
  accessKey    : process.env.NEFIT_ACCESS_KEY,
  password     : process.env.NEFIT_PASSWORD,
});

// Connect client and retrieve UI status.
client.connect().then( () => {
  return Promise.all([
    client.get('/ecus/rrc/uiStatus'),
    client.get('/system/appliance/systemPressure'),
    client.get('/system/sensors/temperatures/outdoor_t1'),
  ]);
}).spread((status, pressure, outdoor) => {
  console.log(
    'Temperature is set to %s°C, current is %s°C.\n' +
    'Outside temperature is %s°%s.\n' +
    'System pressure is %s %s.',
    Number(status.value.IHT).toFixed(1),
    Number(status.value.TSP).toFixed(1),
    outdoor.value,
    outdoor.unitOfMeasure,
    pressure.value,
    pressure.unitOfMeasure
  );
}).catch((e) => {
  console.error('error', e)
}).finally(() => {
  client.end();
});
