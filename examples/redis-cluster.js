
'use strict';

// After starting this example load http://localhost:8080 and hit refresh, you will notice that it loads the response from cache for the first 5 seconds and then reloads the cache

// Load modules

const Catbox = require('catbox');
const Http = require('http');
const CatboxRedisCluster = require('..').Cluster; // require('catbox-redis').Cluster on your project



// Declare internals

const internals = {};


internals.handler = function (req, res) {

    internals.getResponse((err, item) => {

        if (err) {
            res.writeHead(500);
            res.end();
        }
        else {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(item);
        }
    });
};


internals.getResponse = function (callback) {

    const key = {
        segment: 'example',
        id: 'myExample'
    };

    const cacheValue = 'my example';
    const ttl = 10000;                         // How long item will be cached in milliseconds

    internals.client.get(key, (err, cached) => {

        if (err) {
            return callback(err);
        }
        else if (cached) {
            return callback(null, 'From cache: ' + cached.item);
        }

        internals.client.set(key, cacheValue, ttl, (error) => {

            callback(error, cacheValue);
        });
    });
};


internals.startCache = function (callback) {

    const engine = new CatboxRedisCluster([
        {
            host: '127.0.0.1',
            port: 7000
        }
    ], {
        redisOptions: {
            password: 'secret',
            partition: 'example'
        }
    });
    internals.client = new Catbox.Client(engine);
    internals.client.start(callback);
};


internals.startServer = function (err) {

    if (err) {
        console.log(err);
        console.log('Could not connect to redis cluster. Ending process.');
        process.exit();
    }
    else {
        const server = Http.createServer(internals.handler);
        server.listen(8080);
        console.log('Server started at http://localhost:8080/');
    }
};


internals.startCache(internals.startServer);
