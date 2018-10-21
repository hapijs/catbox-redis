'use strict';

exports = module.exports = class Connection {
    constructor(options) {

        this.settings = Object.assign({
            db: options.database || options.db,
            name: options.sentinelName,
            tls: options.tls,
            lazyConnect: true
        }, options);
    }

    async stop() {

        try {
            if (this.client && !this.settings.client) {
                this.client.removeAllListeners();
                await this.client.disconnect();
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
        catch (ignoreErr) { } // Handled by validation below

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
