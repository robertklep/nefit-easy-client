module.exports = function(client, opts) {
  return client.put(opts['<uri>'], opts['<data>']);
};

