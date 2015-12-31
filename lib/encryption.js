const crypto       = require('crypto');
const MD5          = (s, encoding) => crypto.createHash('md5').update(s).digest(encoding);

// Magic numbers
const MAGIC = {
  chat  : new Buffer('58f18d70f667c9c79ef7de435bf0f9b1553bbb6e61816212ab80e5b0d351fbb1', 'hex'),
  email : new Buffer('52eafb7a84e95c1dbdb0ffef1aa5c8d1aab8158b5232934f154a7cffee29b923', 'hex'),
  alarm : new Buffer('b7691867799c11d5b837f8a5e86e81c8e6d2bbcc624f157ac4f03d5d3701e11e', 'hex'),
};

function generateKey(magicKey, id_key_uuid, privatePassword) {
  return Buffer.concat([
    MD5( Buffer.concat([ new Buffer(id_key_uuid, 'utf8'), magicKey ]) ),
    MD5( Buffer.concat([ magicKey, new Buffer(privatePassword, 'utf8') ]) )
  ]);
}

var Encryption = module.exports = function Encryption(serialNumber, accessKey, password) {
  if (! (this instanceof Encryption)) return new Encryption(serialNumber, accessKey, password);
  this.chatEncryptionKey  = generateKey(MAGIC.chat,  accessKey,    password);
  this.emailEncryptionKey = generateKey(MAGIC.email, serialNumber, 'gservice_smtp');
  this.alarmEncryptionKey = generateKey(MAGIC.alarm, serialNumber, 'gservice_alarm');
};

Encryption.prototype.decrypt = function(data, type) {
  var key       = this[ (type || 'chat') + 'EncryptionKey' ];
  var encrypted = new Buffer(data, 'base64');
  var decipher  = crypto.createDecipheriv('aes-256-ecb', key, '');

  decipher.setAutoPadding(false);

  // Add zero-padding?
  var paddingLength = encrypted.length % 8;
  if (paddingLength !== 0) {
    console.log('Need %s bytes of padding', paddingLength);
    var padding = new Buffer(paddingLength).fill(0);
    encrypted = Buffer.concat([ encrypted, padding ]);
  }
  return decipher.update(encrypted).toString() + decipher.final().toString();
};
