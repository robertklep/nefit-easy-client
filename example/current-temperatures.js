const NefitEasyClient = require('../lib');

// Instantiate client
const client = NefitEasyClient({
  serialNumber : process.env.NEFIT_SERIAL_NUMBER,
  accessKey    : process.env.NEFIT_ACCESS_KEY,
  password     : process.env.NEFIT_PASSWORD,
});

// Connect client and retrieve UI status.
client.connect().then( () => {
  return client.get('/ecus/rrc/uiStatus');
}).then((r) => {
  console.log(
    'Temperature is set to %s°C, current is %s°C.',
    Number(r.value.IHT).toFixed(1),
    Number(r.value.TSP).toFixed(1)
  );
}).catch((e) => {
  console.error('error', e)
}).finally(() => {
  client.end();
});
