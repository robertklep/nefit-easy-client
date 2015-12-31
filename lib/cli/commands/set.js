module.exports = function(client, opts) {
  if (opts.temperature) {
    return client.put('/heatingCircuits/hc1/temperatureRoomManual', {
      value : Number(opts['<value>'])
    });
  }
  throw new Error('UNKNOWN_PARAMETER');
};
