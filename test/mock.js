'use strict';

// Adapted from https://github.com/luin/ioredis
// Copyright (c) 2015-2019 Zihua Li - MIT Licensed

const EventEmitter = require('events').EventEmitter;
const Net = require('net');

const Parser = require('redis-parser');


const internals = {};


module.exports = internals.MockServer = class extends EventEmitter {

    constructor(port, handler) {

        super();

        this.REDIS_OK = '+OK';

        this.port = port;
        this.handler = handler;

        this.connect();
    }

    connect() {

        this.socket = Net.createServer();

        this.socket.on('connection', (socket) => {

            process.nextTick(() => this.emit('connect', socket));

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
                data = internals.MockServer.REDIS_OK;
            }

            if (data === internals.MockServer.REDIS_OK) {
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
};
