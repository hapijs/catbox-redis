'use strict';

/**
 * This code is originally from the ioredis test suite.
 * It simplifies Redis sentinel/cluster testing,
 * because Travis CI doesn't support it (yet).
 *
 * https://github.com/luin/ioredis/blob/551e67f977cda78e377dd688a1aaf7ab0f2651cf/test/helpers/mock_server.js
 */

const net = require('net');
const util = require('util');
const Parser = require('redis-parser');
const EventEmitter = require('events').EventEmitter;

class MockServer {
    constructor(port, handler) {
        EventEmitter.call(this);
        this.REDIS_OK = '+OK';

        this.port = port;
        this.handler = handler;

        this.connect();
    }

    connect() {
        var _this = this;
        this.socket = net.createServer()

        this.socket.on('connection', function (socket) {
            process.nextTick(function () {
                _this.emit('connect', socket);
            });

            var parser = new Parser({
                returnBuffers: true,
                returnReply: function (reply) {
                    reply = _this.convertBufferToString(reply);
                    _this.write(socket, _this.handler && _this.handler(reply));
                },
                returnError: function (err) { }
            });

            socket.on('end', function () {
                _this.emit('disconnect', socket);
            });

            socket.on('data', function(data) {
                parser.execute(data);
            })
        })

        this.socket.listen(this.port);
    }

    write(c, data) {
        if (c.writable) {
          c.write(convert('', data));
        }

        function convert(str, data) {
          var result;
          if (typeof data === 'undefined') {
            data = MockServer.REDIS_OK;
          }
          if (data === MockServer.REDIS_OK) {
            result = '+OK\r\n';
          } else if (data instanceof Error) {
            result = '-' + data.message + '\r\n';
          } else if (Array.isArray(data)) {
            result = '*' + data.length + '\r\n';
            data.forEach(function (item) {
              result += convert(str, item);
            });
          } else if (typeof data === 'number') {
            result = ':' + data + '\r\n';
          } else if (data === null) {
            result = '$-1\r\n';
          } else {
            data = data.toString();
            result = '$' + data.length + '\r\n';
            result += data + '\r\n';
          }
          return str + result;
        }
    }

    convertBufferToString(value, encoding) {
        const _this = this

        if (value instanceof Buffer) {
            return value.toString(encoding);
        }

        if (Array.isArray(value)) {
            var length = value.length;
            var res = Array(length);
            for (var i = 0; i < length; ++i) {
              res[i] = value[i] instanceof Buffer && encoding === 'utf8'
                ? value[i].toString()
                : _this.convertBufferToString(value[i], encoding);
            }
            return res;
        }

        return value;
    }

    disconnect() {
        this.socket.close();
    }
};


util.inherits(MockServer, EventEmitter);

module.exports = MockServer;
