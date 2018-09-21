'use strict';

/**
 * This code is originally from the ioredis test suite.
 * It simplifies Redis sentinel/cluster testing,
 * because Travis CI doesn't support it (yet).
 *
 * https://github.com/luin/ioredis/blob/551e67f977cda78e377dd688a1aaf7ab0f2651cf/test/helpers/mock_server.js
 */

const Net = require('net');
const Util = require('util');
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

        this.socket = Net.createServer();

        this.socket.on('connection', (socket) => {

            process.nextTick(() => {

                this.emit('connect', socket);
            });

            const parser = new Parser({
                returnBuffers: true,
                returnReply: (reply) => {

                    reply = this.convertBufferToString(reply);
                    this.write(socket, this.handler && this.handler(reply));
                },
                returnError: function () {}
            });

            socket.on('end', function () {

                this.emit('disconnect', socket);
            });

            socket.on('data', (data) => {

                parser.execute(data);
            });
        });

        this.socket.listen(this.port);
    }

    write(c, input) {

        const convert = function (str, data) {

            let result;

            if (typeof data === 'undefined') {
                data = MockServer.REDIS_OK;
            }

            if (data === MockServer.REDIS_OK) {
                result = '+OK\r\n';
            }
            else if (data instanceof Error) {
                result = '-' + data.message + '\r\n';
            }
            else if (Array.isArray(data)) {
                result = '*' + data.length + '\r\n';
                data.forEach((item) => {

                    result += convert(str, item);
                });
            }
            else if (typeof data === 'number') {
                result = ':' + data + '\r\n';
            }
            else if (data === null) {
                result = '$-1\r\n';
            }
            else {
                data = data.toString();
                result = '$' + data.length + '\r\n';
                result += data + '\r\n';
            }

            return str + result;
        };

        if (c.writable) {
            c.write(convert('', input));
        }
    }

    convertBufferToString(value, encoding) {

        if (value instanceof Buffer) {
            return value.toString(encoding);
        }

        if (Array.isArray(value)) {
            const length = value.length;
            const res = Array(length);

            for (let i = 0; i < length; ++i) {
                res[i] = value[i] instanceof Buffer && encoding === 'utf8'
                    ? value[i].toString()
                    : this.convertBufferToString(value[i], encoding);
            }

            return res;
        }

        return value;
    }

    disconnect() {

        this.socket.close();
    }

}


Util.inherits(MockServer, EventEmitter);

module.exports = MockServer;
