
'use strict';

// After starting this example load http://localhost:8080 and hit refresh, you will notice that it loads the response from cache for the first 5 seconds and then reloads the cache

// Load modules

const Catbox = require('catbox');
const Http = require('http');



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

    const options = {
        partition: 'examples',               // For redis this will store items under keys that start with examples:
        host: '127.0.0.1',                   // If you don't supply, 127.0.0.1 is the default
        port: '6379',                        // If you don't supply, 6379 is the default
        password: ''                         // If you don't supply, auth command not sent to redis
    };

    internals.client = new Catbox.Client(require('../'), options);    // Chance require('../') to 'catbox-redis' when running in your project
    internals.client.start(callback);
};


internals.startServer = function (err) {

    if (err) {
        console.log(err);
        console.log('Could not connect to redis. Ending process.');
        process.exit();
    }
    else {
        const server = Http.createServer(internals.handler);
        server.listen(8080);
        console.log('Server started at http://localhost:8080/');
    }
};


internals.startCache(internals.startServer);
