'use strict';

// Load modules

const Redis = require('ioredis');
const Hoek = require('hoek');


const defaults = {
    host: '127.0.0.1',
    port: 6379
};


exports = module.exports = class Connection {

    constructor(options) {

        Hoek.assert(this instanceof Connection, 'Redis cache client must be instantiated using new');

        this.client = null;
        this.settings = Object.assign({}, defaults, options);

        return this;
    }

    start() {

        if (this.settings.client) {
            this.client = this.settings.client;
        }

        if (this.client) {
            return Promise.resolve();
        }

        // Return a promise that is resolved when everything is ready
        return new Promise((resolve, reject) => {

            const options = Object.assign({}, this.settings, {
                db: this.settings.database || this.settings.db,
                name: this.settings.sentinelName,
                tls: this.settings.tls
            });

            const client = Redis.createClient(options);

            // Listen to errors
            client.on('error', (err) => {

                if (!this.client) {        // Failed to connect
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
        catch (ignoreErr) { }   // Handled by validation below

        if (!envelope) {
            throw Error('Bad envelope content');
        }

        if ((!envelope.item && envelope.item !== 0) ||
            !envelope.stored) {

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

    drop(key) {

        if (!this.client) {
            throw Error('Connection not started');
        }

        return this.client.del(this.generateKey(key));
    }

    generateKey({ id, segment }) {

        const parts = [];

        if (this.settings.partition) {
            parts.push(encodeURIComponent(this.settings.partition));
        }

        parts.push(encodeURIComponent(segment));
        parts.push(encodeURIComponent(id));

        return parts.join(':');
    }
};
