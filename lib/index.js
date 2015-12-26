const debug      = require('debug')('nefiteasy');
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

var NefitEasyClient = module.exports = function NefitEasyClient(opts) {
  if (! (this instanceof NefitEasyClient)) return new NefitEasyClient(opts);
  this.opts = Object.assign({}, DEFAULT_OPTIONS, opts);

  // Generate some commonly used properties.
  var suffix    = this.opts.serialNumber + '@' + this.opts.host;
  this.opts.jid = this.opts._from = 'rrccontact_' + suffix;
  this.opts._to = 'rrcgateway_' + suffix;

  // Initialize crypto stuff
  this.encryption = Encryption(this.opts.accessKey, this.opts.password);

  // Create XMPP client (+ connection)
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
        this.send('<presence/>');
        resolve(r);
      }).once('error', (e) => {
        this.client.removeAllListeners('online');
        reject(e);
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
  var stanza = new Stanza('message', {
    from : this.opts._from,
    to   : this.opts._to
  }).c('body').t(`GET ${ uri } HTTP/1.1\rUser-Agent: NefitEasy\r\r`);
  debug('Sending message');
  rawDebug(stanza.root().toString().replace(/\r/g, '\n'));
  return new Promise((resolve, reject) => {
    this.client.once('stanza', (stanza) => {
      this.client.removeAllListeners('error');
      debug('Received stanza');
      rawDebug(stanza.root().toString());
      if (stanza.is('message')) {
        var response = HTTPParser.parseResponse(stanza.root().getChild('body').getText().replace(/\n/g, '\r\n'));
        if (response.statusCode !== '200') {
          debug('Unexpected response', response);
          return reject(response.statusMessage);
        }

        // Decrypt message body and remove any padding.
        var decrypted = this.encryption.decrypt(response.body).replace(/\0*$/g, '');

        // Parse JSON responses.
        if (response.headers && response.headers['Content-Type'] === 'application/json') {
          try {
            decrypted = JSON.parse(decrypted);
          } catch(e) {
            return reject(e);
          }
        }
        return resolve(decrypted);
      } else {
        return resolve(stanza);
      }
    }).once('error', (e) => {
      this.client.removeAllListeners('stanza');
      return reject(e);
    }).send(stanza);
  });
};
