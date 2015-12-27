const debug      = require('debug')('nefiteasy');
const Queue      = require('promise-queue');
const rawDebug   = require('debug')('nefiteasy:raw');
const HTTPParser = require('http-string-parser');
const Promise    = require('bluebird');
const XMPPClient = require('node-xmpp-client');
const Stanza     = XMPPClient.Stanza;
const Encryption = require('./encryption');

const DEFAULT_OPTIONS = {
  host          : 'wa2-mz36-qrmzh6.bosch.de',
  saslMechanism : 'DIGEST-MD5',
};

Queue.configure(Promise);

var NefitEasyClient = module.exports = function NefitEasyClient(opts) {
  if (! (this instanceof NefitEasyClient)) return new NefitEasyClient(opts);

  // Merge options with defaults.
  this.opts = Object.assign({}, DEFAULT_OPTIONS, opts);

  // Generate some commonly used properties.
  var suffix    = this.opts.serialNumber + '@' + this.opts.host;
  this.opts.jid = this.opts._from = 'rrccontact_' + suffix;
  this.opts._to = 'rrcgateway_' + suffix;

  // Queue with pending requests. This allows us to limit the number of
  // concurrent requests to 1, which is a requirement imposed by the backend.
  this.queue = new Queue(1, Infinity);

  // Initialize crypto stuff
  this.encryption = Encryption(this.opts.accessKey, this.opts.password);

  // Create XMPP client.
  this.client = new XMPPClient({
    host                   : this.opts.host,
    jid                    : this.opts.jid,
    password               : 'Ct7ZR03b_' + this.opts.accessKey,
    preferredSaslMechanism : this.opts.saslMechanism,
    autostart              : false,
  });
};

NefitEasyClient.prototype.end = function() {
  this.client.end();
};

NefitEasyClient.prototype.connect = function() {
  // If not already connected/connecting, create a promise that is resolved
  // when a connection has been made (or rejected if an error occurred).
  if (! this.connectionPromise) {
    this.connectionPromise = new Promise((resolve, reject) => {
      this.client.once('online', (r) => {
        this.client.removeAllListeners('error');

        // Announce our presence.
        this.send('<presence/>');

        // Resolve the connection promise.
        return resolve(r);
      }).once('error', (e) => {
        this.client.removeAllListeners('online');
        return reject(e);
      }).connect();
    });
  }

  // Return the promise.
  return this.connectionPromise;
};

NefitEasyClient.prototype.send = function(msg) {
  this.client.send(msg);
};

NefitEasyClient.prototype.get = function(uri) {
  // Create the message.
  var stanza = new Stanza('message', {
    from : this.opts._from,
    to   : this.opts._to,
  }).c('body').t(`GET ${ uri } HTTP/1.1\rUser-Agent: NefitEasy\r\r`);

  // Queue the request
  debug('Queuing request for', uri);
  return this.queue.add(() => {
    // Send the message.
    debug('Sending message'); rawDebug(stanza.root().toString().replace(/\r/g, '\n'));
    this.client.send(stanza);

    // Return a new promise that gets resolved once the response has been
    // received (or rejected).
    return new Promise((resolve, reject) => {
      var removeListeners = () => {
        this.client.removeListener('stanza', stanzaHandler);
        this.client.removeListener('error',  errorHandler);
      };
      var stanzaHandler = (stanza) => {
        // Process stanza.
        debug('Received stanza'); rawDebug(stanza.root().toString());

        if (stanza.is('message')) {
          // Clear listeners.
          removeListeners();

          // Error?
          var type = stanza.attrs.type;
          if (type === 'error') {
            return reject({
              type : 'stanza',
              data : stanza.root(),
            });
          }

          // Chat?
          if (type === 'chat') {
            var response = HTTPParser.parseResponse(stanza.root().getChild('body').getText().replace(/\n/g, '\r\n'));
            if (response.statusCode !== '200') {
              return reject({
                type : 'response',
                data : response,
              });
            }

            // Decrypt message body and remove any padding.
            var decrypted = this.encryption.decrypt(response.body).replace(/\0*$/g, '');

            // Parse JSON responses.
            if (response.headers && response.headers['Content-Type'] === 'application/json') {
              try {
                decrypted = JSON.parse(decrypted);
              } catch(e) {
                return reject({
                  type : 'error',
                  data : e
                });
              }
            }
            return resolve(decrypted);
          }
        }
      };
      var errorHandler = (e) => {
        // Clear listeners.
        removeListeners();
        return reject({
          type : 'error',
          data : e
        });
      };
      this.client.on('stanza', stanzaHandler);
      this.client.on('error',  errorHandler);
    });
  });
};

NefitEasyClient.prototype.pressure = function() {
  return this.get('/system/appliance/systemPressure').then((r) => {
    return { pressure : r.value, unit : r.unitOfMeasure };
  });
};

function parseBoolean(value) {
  return value === 'on' ? true : value === 'off' ? false : null;
}

NefitEasyClient.prototype.status = function() {
  return Promise.all([
    this.get('/ecus/rrc/uiStatus'),
    this.get('/system/sensors/temperatures/outdoor_t1'),
  ]).spread((status, outdoor) => {
    var v = status.value;
    return {
      'user mode'                   : v.UMD,
      'clock program'               : v.CPM,
      'in house status'             : v.IHS,
      'in house temp'               : Number(v.IHT),
      'boiler indicator'            : v.BAI,
      'control'                     : v.CTR,
      'temp override duration'      : Number(v.TOD),
      'current switchpoint'         : v.CSP,
      'ps active'                   : parseBoolean(v.ESI),
      'fp active'                   : parseBoolean(v.FPA),
      'temp override'               : parseBoolean(v.TOR),
      'holiday mode'                : parseBoolean(v.HMD),
      'boiler block'                : parseBoolean(v.BBE),
      'boiler lock'                 : parseBoolean(v.BLE),
      'boiler maintainance'         : parseBoolean(v.BMR),
      'temp setpoint'               : Number(v.TSP),
      'temp override temp setpoint' : Number(v.TOT),
      'temp manual setpoint'        : Number(v.MMT),
      'hed enabled'                 : parseBoolean(v.HED_EN),
      'hed device at home'          : parseBoolean(v.HED_DEV),
      'outdoor temp'                : outdoor.value,
      'outdoor source type'         : outdoor.srcType,
    };
  });
};

NefitEasyClient.prototype.location = function() {
  return Promise.props({
    lat : this.get('/system/location/latitude') .then((r) => Number(r.value)),
    lng : this.get('/system/location/longitude').then((r) => Number(r.value)),
  });
};

function parseProgramData(data) {
  return data.filter((point) => point.active === 'on').map((point) => {
    var hour   = (point.t / 60) | 0;
    var minute = point.t % 60;
    return {
      dow  : [ 'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa' ].indexOf(point.d),
      time : ('00' + hour).slice(-2) + ':' + ('00' + minute).slice(-2),
      temp : point.T
    };
  })
}

NefitEasyClient.prototype.program = function() {
  return Promise.props({
    active   : this.get('/ecus/rrc/userprogram/activeprogram').then((r) => r.value),
    program1 : this.get('/ecus/rrc/userprogram/program1').then((r) => parseProgramData(r.value)),
    program2 : this.get('/ecus/rrc/userprogram/program2').then((r) => parseProgramData(r.value)),
  });
};
