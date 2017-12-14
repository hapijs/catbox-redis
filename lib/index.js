
'use strict';

// Load modules

const Redis = require('ioredis');
const Hoek = require('hoek');


// Declare internals

const internals = {};


internals.defaults = {
    host: '127.0.0.1',
    port: 6379
};


exports = module.exports = internals.Connection = function (options) {

    Hoek.assert(this.constructor === internals.Connection, 'Redis cache client must be instantiated using new');

    this.settings = Object.assign({}, internals.defaults, options);
    this.client = null;
    return this;
};


// Async
internals.Connection.prototype.start = function () {

    if (this.settings.client) {
        this.client = this.settings.client;
    }

    if (this.client) {
        return Promise.resolve();
    }

    // Return a promise that is resolved when everything is ready
    return new Promise((resolve, reject) => {

        let client;

        const options = {
            password: this.settings.password,
            db: this.settings.database || this.settings.db
        };

        if (this.settings.sentinels && this.settings.sentinels.length) {
            options.sentinels = this.settings.sentinels;
            options.name = this.settings.sentinelName;
            client = Redis.createClient(options);
        }
        else if (this.settings.url) {
            client = Redis.createClient(this.settings.url, options);
        }
        else if (this.settings.socket) {
            client = Redis.createClient(this.settings.socket, options);
        }
        else {
            client = Redis.createClient(this.settings.port, this.settings.host, options);
        }

        // Listen to errors
        client.on('error', (err) => {

            if (!this.client) {             // Failed to connect
                client.end(false);
                return reject(err);
            }
        });

        // Wait for connection
        client.once('ready', () => {

            this.client = client;
            return resolve();
        });
    });
};


internals.Connection.prototype.stop = async function () {

    try {
        if (this.client && !this.settings.client) {
            this.client.removeAllListeners();
            await this.client.quit();
        }
    }
    finally {
        this.client = null;
    }
};


internals.Connection.prototype.isReady = function () {

    return !!this.client && this.client.status === 'ready';
};


internals.Connection.prototype.validateSegmentName = function (name) {

    if (!name) {
        return new Error('Empty string');
    }

    if (name.indexOf('\0') !== -1) {
        return new Error('Includes null character');
    }

    return null;
};


internals.Connection.prototype.get = async function (key) {

    if (!this.client) {
        throw Error('Connection not started');
    }

    const result = await this.client.get(this.generateKey(key));

    if (!result) {
        return null;
    }

    let envelope = null;
    try {
        envelope = JSON.parse(result);
    }
    catch (err) { }   // Handled by validation below

    if (!envelope) {
        throw Error('Bad envelope content');
    }

    if ((!envelope.item && envelope.item !== 0) ||
        !envelope.stored) {

        throw Error('Incorrect envelope structure');
    }

    return envelope;
};


internals.Connection.prototype.set = async function (key, value, ttl) {

    if (!this.client) {
        throw Error('Connection not started');
    }

    const envelope = {
        item: value,
        stored: Date.now(),
        ttl
    };

    const cacheKey = this.generateKey(key);

    const stringifiedEnvelope = JSON.stringify(envelope);

    await this.client.set(cacheKey, stringifiedEnvelope);

    const ttlSec = Math.max(1, Math.floor(ttl / 1000));
    // Use 'pexpire' with ttl in Redis 2.6.0
    return this.client.expire(cacheKey, ttlSec);
};


// Async
internals.Connection.prototype.drop = function (key) {

    if (!this.client) {
        throw Error('Connection not started');
    }
    return this.client.del(this.generateKey(key));
};


internals.Connection.prototype.generateKey = function (key) {

    const parts = [];

    if (this.settings.partition) {
        parts.push(encodeURIComponent(this.settings.partition));
    }

    parts.push(encodeURIComponent(key.segment));
    parts.push(encodeURIComponent(key.id));

    return parts.join(':');
};
