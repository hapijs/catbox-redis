'use strict';

const Redis = require('ioredis');
const Hoek = require('hoek');
const Base = require('./base');

const defaults = {
    host: '127.0.0.1',
    port: 6379
};

exports = module.exports = class Connection extends Base {

    constructor(options) {

        const settings = Object.assign({}, defaults, options);
        super(settings);

        Hoek.assert(this instanceof Connection, 'Redis cache client must be instantiated using new');
    }


    async start() {

        if (this.settings.client) {
            this.client = this.settings.client;
        }

        if (this.client) {
            return;
        }

        let client;

        if (this.settings.url) {
            client = new Redis(this.settings.url, this.settings);
        }
        else if (this.settings.socket) {
            client = new Redis(this.settings.socket, this.settings);
        }
        else {
            client = new Redis(this.settings);
        }

        client.on('error', () => {

            if (!this.client) { // Failed to connect
                client.disconnect();
            }
        });

        await client.connect();
        this.client = client;
    }
};
