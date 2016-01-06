var Promise   = require('bluebird');
var http      = require('http');
var accum     = require('accum');
var send      = require('send-data');
var sendJson  = require('send-data/json');
var sendError = require('send-data/error');

module.exports = (client, opts) => {
  return new Promise((resolve, reject) => {
    var server = http.createServer((req, res) => {
      // Combined-like request log
      res.on('finish', () => {
        console.log('%s - - [%s] "%s %s" %s %s',
          req.socket.remoteAddress,
          new Date().toISOString(),
          req.method,
          req.url,
          res.statusCode,
          res.getHeader('content-length') || 0
        );
      });

      // Check method to make sure it's allowed.
      if (! /^get|post|put$/i.test(req.method)) {
        return send(req, res, {
          statusCode : 405,
          headers    : { Allow : 'GET, POST, PUT' }
        });
      }

      // Only handle /bridge requests
      if (! req.url.startsWith('/bridge')) {
        return send(req, res, { statusCode : 404 });
      }

      // Determine the endpoint to call by stripping the `/bridge` prefix.
      var endpoint = req.url.substring(7);

      // Perform the request.
      if (req.method === 'GET') {
        return client.get(endpoint).then((r) => {
          return sendJson(req, res, r);
        }, (e) => {
          return sendError(req, res, { body : e });
        });
      } else { // POST/PUT
        return req.pipe(accum.string((data) => {
          return client.put(endpoint, data).then((r) => {
            return sendJson(req, res, r);
          });
        })).on('error', (e) => {
          return sendError(req, res, { body : e });
        });
      }
    }).on('close', resolve).on('error', reject).on('listening', () => {
      var addr = server.address();
      console.log('HTTP server listening on http://%s:%s', addr.address, addr.port);
    }).listen(opts['--port'], opts['--host']);
  });
};
