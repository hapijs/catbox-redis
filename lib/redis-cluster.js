'use strict';

const Hoek = require('hoek');
const Redis = require('ioredis');
const Base = require('./base');

module.exports = class ClusterConnection extends Base {
    constructor(nodes, options) {

        const settings = (options || {}).redisOptions || {};

        super(settings);
        this.nodes = nodes;
        this.options = options;

        Hoek.assert(this instanceof ClusterConnection, 'Redis Cluster cache client must be instantiated using new');
    }

    start() {

        return new Promise((resolve, reject) => {

            const client = this.client = new Redis.Cluster(this.nodes, this.options);
            client.once('ready', resolve);
            client.once('error', reject);
        });
    }
};

