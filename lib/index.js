'use strict';

// Load modules

const Redis = require('ioredis');
const { ok: assert } = require('assert');


// Declare internals

const internals = {};


internals.defaults = {
    host: '127.0.0.1',
    port: 6379
};

module.exports = class Connection {
    constructor(options) {

        assert(this.constructor === Connection, 'Redis cache client must be instantiated using new');

        this.settings = Object.assign({}, internals.defaults, options);
        this.client = null;
        return this;
    }

    async start() {

        if (this.settings.client) {
            this.client = this.settings.client;
        }

        if (this.client) {
            return;
        }


        let client;

        const options = {
            password: this.settings.password,
            db: this.settings.database || this.settings.db,
            tls: this.settings.tls
        };

        if (this.settings.sentinels && this.settings.sentinels.length) {
            options.sentinels = this.settings.sentinels;
            options.name = this.settings.sentinelName;
            client = new Redis(options);
        }
        else if (this.settings.url) {
            client = new Redis(this.settings.url, options);
        }
        else if (this.settings.socket) {
            client = new Redis(this.settings.socket, options);
        }
        else {
            client = new Redis(this.settings.port, this.settings.host, options);
        }

        await new Promise((resolve, reject) => {
            // Listen to errors
            client.once('error', (err) => {

                if (!this.client) { // Failed to connect
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

    }

    async stop() {

        try {
            if (this.client && !this.settings.client) {
                this.client.removeAllListeners();
                await this.client.quit();
            }
        }
        finally {
            this.client = null;
        }
    }

    isReady() {

        return !!this.client && this.client.status === 'ready';
    }

    validateSegmentName(name) {

        if (!name) {
            return new Error('Empty string');
        }

        if (name.indexOf('\0') !== -1) {
            return new Error('Includes null character');
        }

        return null;
    }

    async get(key) {

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

        if (!envelope.stored || !envelope.hasOwnProperty('item')) {
            throw Error('Incorrect envelope structure');
        }

        return envelope;
    }

    async set(key, value, ttl) {

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
    }

    async drop(key) {

        if (!this.client) {
            throw Error('Connection not started');
        }
        return await this.client.del(this.generateKey(key));
    }

    generateKey(key) {

        const parts = [];

        if (this.settings.partition) {
            parts.push(encodeURIComponent(this.settings.partition));
        }

        parts.push(encodeURIComponent(key.segment));
        parts.push(encodeURIComponent(key.id));

        return parts.join(':');
    }
};
