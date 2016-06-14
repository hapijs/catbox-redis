
'use strict';

// Load modules

const Redis = require('redis');
const Hoek = require('hoek');


// Declare internals

const internals = {};


internals.defaults = {
    host: '127.0.0.1',
    port: 6379
};


exports = module.exports = internals.Connection = function (options) {

    Hoek.assert(this.constructor === internals.Connection, 'Redis cache client must be instantiated using new');

    this.settings = Hoek.applyToDefaults(internals.defaults, options);
    this.client = options.client || null;
    return this;
};


internals.Connection.prototype.start = function (callback) {

    callback = Hoek.once(callback);

    const self = this;
    if (this.client) {
        return Hoek.nextTick(callback)();
    }

    let client;

    if (this.settings.socket) {
        client = Redis.createClient(this.settings.socket);
    }
    else {
        client = Redis.createClient(this.settings.port, this.settings.host);
    }

    if (this.settings.password) {
        client.auth(this.settings.password);
    }

    if (this.settings.database) {
        client.select(this.settings.database);
    }

    // Listen to errors

    client.on('error', (err) => {

        if (!self.client) {                             // Failed to connect
            client.end(false);
            return callback(err);
        }
    });

    // Wait for connection

    client.once('ready', () => {

        self.client = client;
        return callback();
    });
};


internals.Connection.prototype.stop = function () {

    if (this.client) {
        this.client.removeAllListeners();
        this.client.quit();
        this.client = null;
    }
};


internals.Connection.prototype.isReady = function () {

    return !!this.client && this.client.connected;
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


internals.Connection.prototype.get = function (key, callback) {

    if (!this.client) {
        return callback(new Error('Connection not started'));
    }

    this.client.get(this.generateKey(key), (err, result) => {

        if (err) {
            return callback(err);
        }

        if (!result) {
            return callback(null, null);
        }

        let envelope = null;
        try {
            envelope = JSON.parse(result);
        }
        catch (err) { }     // Handled by validation below

        if (!envelope) {
            return callback(new Error('Bad envelope content'));
        }

        if (!envelope.item ||
            !envelope.stored) {

            return callback(new Error('Incorrect envelope structure'));
        }

        return callback(null, envelope);
    });
};


internals.Connection.prototype.set = function (key, value, ttl, callback) {

    const self = this;

    if (!this.client) {
        return callback(new Error('Connection not started'));
    }

    const envelope = {
        item: value,
        stored: Date.now(),
        ttl: ttl
    };

    const cacheKey = this.generateKey(key);

    let stringifiedEnvelope = null;

    try {
        stringifiedEnvelope = JSON.stringify(envelope);
    }
    catch (err) {
        return callback(err);
    }

    this.client.set(cacheKey, stringifiedEnvelope, (err) => {

        if (err) {
            return callback(err);
        }

        const ttlSec = Math.max(1, Math.floor(ttl / 1000));
        self.client.expire(cacheKey, ttlSec, (err) => {        // Use 'pexpire' with ttl in Redis 2.6.0

            return callback(err);
        });
    });
};


internals.Connection.prototype.drop = function (key, callback) {

    if (!this.client) {
        return callback(new Error('Connection not started'));
    }

    this.client.del(this.generateKey(key), (err) => {

        return callback(err);
    });
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
