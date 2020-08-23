'use strict';

const Hoek = require('@hapi/hoek');
const IoRedis = require('ioredis');
const Joi = require('joi');


const internals = {
    schema: {
        partition: Joi.string().default(''),
        host: Joi.object({
            host: Joi.string().default('127.0.0.1'),
            port: Joi.number().integer().positive().default(6379)
        })
    }
};


internals.schema.cluster = Joi.array()
    .items(internals.schema.host)
    .min(1);


internals.schema.common = Joi.object({

    partition: internals.schema.partition,

    // Redis options

    db: [Joi.string(), Joi.number()],

    password: Joi.string().allow(''),
    tls: Joi.object(),
    sentinels: internals.schema.cluster,
    name: Joi.string()
})
    .rename('database', 'db')
    .rename('sentinelName', 'name')
    .without('db', 'database')
    .with('name', 'sentinels')
    .unknown();


internals.schema.options = Joi.alternatives([
    Joi.object({
        client: Joi.object().required(),
        partition: internals.schema.partition
    })
        .unknown(),

    internals.schema.common.keys({
        url: Joi.string().uri(),
        socket: Joi.string(),
        cluster: internals.schema.cluster
    })
        .xor('url', 'socket', 'cluster'),

    internals.schema.common.concat(internals.schema.host)
]);


module.exports = class {

    constructor(options = {}) {

        this.settings = Joi.attempt(options, internals.schema.options);
    }

    async start() {

        // Skip if already started

        if (this.client) {
            return;
        }

        // Externally managed clients

        if (this.settings.client) {
            this.client = this.settings.client;
            return;
        }

        // Normalize Redis options

        const redisOptions = Hoek.clone(this.settings);
        redisOptions.lazyConnect = !this.settings.cluster;

        for (const key of ['client', 'cluster', 'partition', 'socket', 'url']) {
            delete redisOptions[key];
        }

        // Cluster

        if (this.settings.cluster) {
            return new Promise((resolve, reject) => {

                this.client = new IoRedis.Cluster(this.settings.cluster, redisOptions);
                this.client.once('ready', resolve);
                this.client.on('error', reject);
            });
        }

        // Single connection

        const client = this._connection(redisOptions);

        client.on('error', () => {

            if (!this.client) {         // Failed to connect
                client.disconnect();
            }
        });

        await client.connect();
        this.client = client;
    }

    _connection(options) {

        if (this.settings.url) {
            return new IoRedis(this.settings.url, options);
        }

        if (this.settings.socket) {
            return new IoRedis(this.settings.socket, options);
        }

        return new IoRedis(options);
    }

    async stop() {

        if (!this.client) {
            return;
        }

        try {
            if (!this.settings.client) {
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

        try {
            var envelope = JSON.parse(result);
        }
        catch (ignoreErr) { } // Handled by validation below

        if (!envelope) {
            throw Error('Bad envelope content');
        }

        if (!envelope.stored ||
            !envelope.hasOwnProperty('item')) {

            throw Error('Incorrect envelope structure');
        }

        return envelope;
    }

    set(key, value, ttl) {

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

        return this.client.psetex(cacheKey, ttl, stringifiedEnvelope);
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
