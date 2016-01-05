var Promise   = require('bluebird');
var http      = require('http');
var accum     = require('accum');
var send      = require('send-data');
var sendJson  = require('send-data/json');
var sendError = require('send-data/error');

module.exports = (client, opts) => {
  return new Promise((resolve, reject) => {
    var server = http.createServer((req, res) => {
      res.on('finish', () => {
        console.log('%s - - [%s] "%s %s" %s %s',
          req.socket.remoteAddress,
          new Date().toISOString(),
          req.method,
          req.url,
          res.statusCode,
          res.getHeader('content-length')
        );
      });
      if (req.method === 'GET') {
        return client.get(req.url).then((r) => {
          return sendJson(req, res, r);
        }, (e) => {
          return sendError(req, res, { body : e });
        });
      } else if (req.method === 'POST' || req.method === 'PUT') {
        return req.pipe(accum.string((data) => {
          return sendJson(req, res, { method : 'post', data : data, url : req.url });
        })).on('error', (e) => {
          return sendError(req, res, { body : e });
        });
      }
      return send(req, res, {
        statusCode : 405,
        headers    : { Allow : 'GET, POST, PUT' }
      });
    }).on('close', resolve).on('error', reject).on('listening', () => {
      var addr = server.address();
      console.log('HTTP server listening on http://%s:%s', addr.address, addr.port);
    }).listen(opts['--port'], opts['--host']);
  });
};
