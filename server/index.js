'use strict';
//-- vim: ft=javascript tabstop=2 softtabstop=2 expandtab shiftwidth=2

const http = require('http');
const config = require('../config');
const { debug, info, error } = require('../lib/logger');
const setupWebsocketServer = require('./server');
const Api = require('./api');
const ClientsManager = require('./clients-manager');

function usage() {
  console.log(`USAGE:

    server [[<server_host>:]<server_port>]

    server_host   ... hostname or ip address of websocket proxy server
                      (defaults to 0.0.0.0)
    server_port   ... port of websocket proxy server (defaults to 8000)

`);
}

function Server() {

  this.clientsManager = new ClientsManager({
      allowed_keys: true,  // true - pass any key; a list - pass individual keys
      path_prefix: '/ws',
    });
  this.apiServer = new Api( '/api', this.clientsManager);
  this.httpServer = http.createServer(this.apiServer.request_handler);
  this.webSocketServer = setupWebsocketServer(this.httpServer, this.clientsManager);

  this.httpServer.on("listening", () => {
    let addr = this.httpServer.address();
    info(`
      Listening on ${addr.address}:${addr.port}.
      To connect clients run:

      node client <client-key> <server-host>:${addr.port} <uri-to-redirect-to>
      `);

  })
  .on('close', () => {
    info('Connection closed.');
  })
  .on('error', (err) => {
    error(`Error ${err} occured.`);
  });

  this.listen = function listen(port, host) {
    return new Promise((resolve, reject) => {
      this.httpServer.once('error', reject);
      this.httpServer.once('listening', (...args) => {
        this.httpServer.off('error', reject);
        resolve(...args);
      });
      this.httpServer.listen(port, host);
    });
  }

  this.close = this.httpServer.close.bind(this.httpServer);
}
module.exports = Server;


if (require.main == module) {

  let server_host, server_port;
  if (process.argc > 1) {
    [server_host, server_port] = process.argv[2].split(':', 2);
    if (server_port === undefined && !isNaN(server_host)) {
      server_port = config.server.port;
      server_host = config.server.host;
    }
  } else {
    [server_host, server_port] = [config.server.host, config.server.port];
  }

  debug(`
    config: ${server_host}:${server_port}
  `);

  new Server().listen(server_port, server_host);

}
