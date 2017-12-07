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
    this.readClient = null;
    return this;
};


// Async
internals.Connection.prototype.start = function () {

    // Return a promise that is resolved when everything is ready
    return new Promise((resolve, reject) => {

        if (this.client) {
            return resolve();
        }

        let client;
        let readClient;

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

        if (this.settings.readReplica) {
            const replicaSettings = this.settings.readReplica;

            const replicaOptions = {
                password: replicaSettings.password,
                db: replicaSettings.database || replicaSettings.db
            };

            if (replicaSettings.url) {
                readClient = Redis.createClient(replicaSettings.url, replicaOptions);
            }
            else if (replicaSettings.socket) {
                readClient = Redis.createClient(replicaSettings.socket, replicaOptions);
            }
            else {
                readClient = Redis.createClient(replicaSettings.port, replicaSettings.host, replicaOptions);
            }

            readClient.on('error', (err) => {

                if (!this.readClient) { // Failed to connect
                    readClient.end(false);
                    client.end(false);
                    return reject(err);
                }
            });
        }

        // Listen to errors
        client.on('error', (err) => {

            if (!this.client) { // Failed to connect
                client.end(false);
                if (readClient) {
                    readClient.end(false);
                }
                return reject(err);
            }
        });

        // Wait for connection
        client.once('ready', () => {

            this.client = client;
            if (readClient) {
                readClient.once('ready', () => {

                    this.readClient = readClient;
                    return resolve();
                });
            }
            else {
                return resolve();
            }
        });
    });
};


internals.Connection.prototype.stop = function () {

    if (this.client) {
        this.client.removeAllListeners();
        this.client.quit();
        this.client = null;
    }

    if (this.readClient) {
        this.readClient.removeAllListeners();
        this.readClient.quit();
        this.readClient = null;
    }
};


internals.Connection.prototype.isReady = function () {

    const status = !!this.client && this.client.status === 'ready';

    if (this.readClient) {
        return this.readClient.status && status;
    }

    return status;
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

    let client = this.client;

    if (this.readClient) {
        client = this.readClient;
    }

    if (!client) {
        throw Error('Connection not started');
    }

    const result = await client.get(this.generateKey(key));

    if (!result) {
        return null;
    }

    let envelope = null;
    try {
        envelope = JSON.parse(result);
    }
    catch (err) { } // Handled by validation below

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
