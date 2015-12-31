var fs     = require('fs');
var path   = require('path');
var docopt = require('docopt').docopt;
var Client = require('../../index');

// Parse command line options.
var opts = docopt(fs.readFileSync(__dirname + '/docopt.txt', 'utf8'), {
  version : require('../../package').version
});

module.exports = function() {
  // Determine which command to perform.
  var cmd = process.argv[2];

  // Load command module.
  try {
    var mod = require('./commands/' + cmd);
  } catch(e) {
    console.error('Unknown or unimplemented command `%s`', cmd);
    process.exit(1);
  }

  // Instantiate client.
  const client = Client({
    serialNumber : opts['--serial']     || process.env.NEFIT_SERIAL_NUMBER,
    accessKey    : opts['--access-key'] || process.env.NEFIT_ACCESS_KEY,
    password     : opts['--password']   || process.env.NEFIT_PASSWORD,
  });

  // Perform command.
  return client.connect().then(() => mod(client, opts)).then((r) => {
    console.log('%j', r);
  }).catch((err) => {
    console.error(err);
    if (opts['--verbose']) {
      console.error(err.stack);
    }
    process.exit(1);
  }).finally(() => {
    client.end();
  });
};
