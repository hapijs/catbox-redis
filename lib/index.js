
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
    this.client = options.client || null;
    return this;
};


internals.Connection.prototype.start = function () {
    if (this.client) {
        return;
    }

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

    // Return a promise that is resolved when everything is ready
    return new Promise((resolve, reject) => {
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


internals.Connection.prototype.stop = function () {

    if (this.client) {
        this.client.removeAllListeners();
        this.client.quit();
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


internals.Connection.prototype.get = function (key) {
    return new Promise((resolve, reject) => {
        if (!this.client) {
            return reject(new Error('Connection not started'));
        }
    
        this.client.get(this.generateKey(key), (err, result) => {
    
            if (err) {
                return reject(err);
            }
    
            if (!result) {
                return resolve(null);
            }
    
            let envelope = null;
            try {
                envelope = JSON.parse(result);
            }
            catch (err) { }     // Handled by validation below
    
            if (!envelope) {
                return reject(new Error('Bad envelope content'));
            }
    
            if (!envelope.item ||
                !envelope.stored) {
    
                return reject(new Error('Incorrect envelope structure'));
            }
    
            return resolve(envelope);
        });
    });
};


internals.Connection.prototype.set = function (key, value, ttl) {
    return new Promise((resolve, reject) => {
        if (!this.client) {
            return reject(new Error('Connection not started'));
        }
    
        const envelope = {
            item: value,
            stored: Date.now(),
            ttl
        };
    
        const cacheKey = this.generateKey(key);
    
        let stringifiedEnvelope = null;
    
        try {
            stringifiedEnvelope = JSON.stringify(envelope);
        }
        catch (err) {
            return reject(err);
        }
    
        this.client.set(cacheKey, stringifiedEnvelope, (err) => {
            if (err) {
                return reject(err);
            }
    
            const ttlSec = Math.max(1, Math.floor(ttl / 1000));
            this.client.expire(cacheKey, ttlSec, (err) => {   // Use 'pexpire' with ttl in Redis 2.6.0
                if(err) {
                    return reject(err);
                }
                else {
                    return resolve();
                }
            });
        });
    });
};


internals.Connection.prototype.drop = function (key) {
    return new Promise((resolve, reject) => {
        if (!this.client) {
            return reject(new Error('Connection not started'));
        }
    
        this.client.del(this.generateKey(key), (err) => {
            if(err) {
                return reject(err);
            }
            else {
                return resolve();
            }
        });
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
