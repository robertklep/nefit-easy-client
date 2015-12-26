const crypto       = require('crypto');
const MAGIC_NUMBER = new Buffer('58f18d70f667c9c79ef7de435bf0f9b1553bbb6e61816212ab80e5b0d351fbb1', 'hex');
const MD5          = (s, encoding) => crypto.createHash('md5').update(s).digest(encoding);

function generateKey(magicKey, id_key_uuid, privatePassword) {
  return Buffer.concat([
    MD5( Buffer.concat([ new Buffer(id_key_uuid, 'utf8'), magicKey ]) ),
    MD5( Buffer.concat([ magicKey, new Buffer(privatePassword, 'utf8') ]) )
  ]);
}

var Encryption = module.exports = function Encryption(accessKey, password) {
  if (! (this instanceof Encryption)) return new Encryption(accessKey, password);
  this.encryptionKey = generateKey(MAGIC_NUMBER, accessKey, password);
};

Encryption.prototype.decrypt = function(data) {
  var encrypted = new Buffer(data, 'base64');
  var decipher  = crypto.createDecipheriv('aes-256-ecb', this.encryptionKey, '');

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
