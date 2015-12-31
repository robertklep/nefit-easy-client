const Promise    = require('bluebird');
const Queue      = require('promise-queue'); Queue.configure(Promise);
const debug      = require('debug')('nefit-easy-client');
const rawDebug   = require('debug')('nefit-easy-client:raw');
const HTTPParser = require('http-string-parser');
const XMPPClient = require('node-xmpp-client');
const Stanza     = XMPPClient.Stanza;
const Encryption = require('./encryption');

// Default options for XMPP
const DEFAULT_OPTIONS = {
  host          : 'wa2-mz36-qrmzh6.bosch.de',
  saslMechanism : 'DIGEST-MD5',
};

// Various prefixes used by Bosch.
const ACCESSKEY_PREFIX   = 'Ct7ZR03b_';
const RRC_CONTACT_PREFIX = 'rrccontact_';
const RRC_GATEWAY_PREFIX = 'rrcgateway_';

var NefitEasyClient = module.exports = function NefitEasyClient(opts) {
  if (! (this instanceof NefitEasyClient)) return new NefitEasyClient(opts);

  // Merge options with defaults.
  this.opts = Object.assign({}, DEFAULT_OPTIONS, opts);

  // Generate some commonly used properties.
  var suffix    = this.opts.serialNumber + '@' + this.opts.host;
  this.opts.jid = this.opts._from = RRC_CONTACT_PREFIX + suffix;
  this.opts._to = RRC_GATEWAY_PREFIX + suffix;

  // Queue that holds pending requests. This allows us to limit the number of
  // concurrent requests to 1, which is a requirement imposed by the backend.
  this.queue = new Queue(1, Infinity);

  // Initialize crypto stuff
  this.encryption = Encryption(this.opts.serialNumber, this.opts.accessKey, this.opts.password);

  // Create XMPP client.
  this.client = new XMPPClient({
    host                   : this.opts.host,
    jid                    : this.opts.jid,
    password               : ACCESSKEY_PREFIX + this.opts.accessKey,
    preferredSaslMechanism : this.opts.saslMechanism,
    autostart              : false,
  });
};

Object.assign(NefitEasyClient.prototype, require('./commands'));

NefitEasyClient.prototype.connect = function() {
  // If not already connected/connecting, create a promise that is resolved
  // when a connection has been made (or rejected if an error occurred).
  if (! this.connectionPromise) {
    this.connectionPromise = new Promise((resolve, reject) => {
      this.client.once('online', (r) => {
        this.client.removeAllListeners('error');

        debug('online', r);

        // Announce our presence.
        this.send('<presence/>');

        // Resolve the connection promise.
        return resolve(r);
      }).once('error', (e) => {
        debug('connection error', e);
        this.client.removeAllListeners('online');
        return reject(e);
      }).connect();
    });
  }

  // Return the promise.
  return this.connectionPromise;
};

NefitEasyClient.prototype.end = function() {
  this.client.end();
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
  debug('queuing request for', uri);
  return this.queue.add(() => {
    // Send the message.
    debug('sending message'); rawDebug(stanza.root().toString().replace(/\r/g, '\n'));
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
        debug('received stanza'); rawDebug(stanza.root().toString());

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
            // Parse the response as if it were an HTTP response.
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

        // Reject the request promise.
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
