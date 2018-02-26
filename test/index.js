
'use strict';

// Load modules

const Code = require('code');
const Lab = require('lab');
const Catbox = require('catbox');
const Redis = require('..');
const RedisClient = require('ioredis');
const EventEmitter = require('events').EventEmitter;


// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const describe = lab.describe;
const it = lab.test;
const before = lab.before;
const after = lab.after;


// Utils

const timeoutPromise = (timer) => {

    return new Promise((resolve) => {

        setTimeout(resolve, timer);
    });
};


describe('Redis', () => {

    it('throws an error if not created with new', () => {

        const fn = () => {

            Redis();
        };

        expect(fn).to.throw(Error);
    });

    it('creates a new connection', async () => {

        const client = new Catbox.Client(Redis);
        await client.start();
        expect(client.isReady()).to.equal(true);
    });

    it('closes the connection', async () => {

        const client = new Catbox.Client(Redis);
        await client.start();
        expect(client.isReady()).to.equal(true);
        await client.stop();
        expect(client.isReady()).to.equal(false);
    });

    it('allow passing client in option', () => {

        return new Promise((resolve, reject) =>  {

            const redisClient = RedisClient.createClient();

            let getCalled = false;
            const _get = redisClient.get;
            redisClient.get = function (key, callback) {

                getCalled = true;
                return _get.apply(redisClient, arguments);
            };

            redisClient.on('error', (err) => {

                reject(err);
            });
            redisClient.once('ready', async () => {

                const client = new Catbox.Client(Redis, {
                    client: redisClient
                });
                await client.start();
                expect(client.isReady()).to.equal(true);
                const key = { id: 'x', segment: 'test' };
                await client.get(key);
                expect(getCalled).to.equal(true);

                resolve();
            });
        });
    });

    it('does not stop provided client in options', async () => {

        const redisClient = RedisClient.createClient();

        await new Promise((resolve, reject) => {

            redisClient.once('error', reject);
            redisClient.once('ready', resolve);
        });

        const client = new Catbox.Client(Redis, {
            client: redisClient
        });
        await client.start();
        expect(client.isReady()).to.equal(true);
        await client.stop();
        expect(client.isReady()).to.equal(false);
        expect(redisClient.status).to.equal('ready');
        await redisClient.quit();
    });

    it('gets an item after setting it', async () => {

        const client = new Catbox.Client(Redis);
        await client.start();

        const key = { id: 'x', segment: 'test' };
        await client.set(key, '123', 500);

        const result = await client.get(key);
        expect(result.item).to.equal('123');
    });

    it('fails setting an item circular references', async () => {

        const client = new Catbox.Client(Redis);
        await client.start();
        const key = { id: 'x', segment: 'test' };
        const value = { a: 1 };
        value.b = value;

        await expect((() => {

            return client.set(key, value, 10);
        })()).to.reject(Error, 'Converting circular structure to JSON');
    });

    it('ignored starting a connection twice on same event', () => {

        return new Promise((resolve, reject) => {

            const client = new Catbox.Client(Redis);
            let x = 2;
            const start = async () => {

                await client.start();
                expect(client.isReady()).to.equal(true);
                --x;
                if (!x) {
                    resolve();
                }
            };

            start();
            start();
        });
    });

    it('ignored starting a connection twice chained', async () => {

        const client = new Catbox.Client(Redis);

        await client.start();
        expect(client.isReady()).to.equal(true);

        await client.start();
        expect(client.isReady()).to.equal(true);
    });

    it('returns not found on get when using null key', async () => {

        const client = new Catbox.Client(Redis);
        await client.start();

        const result = await client.get(null);

        expect(result).to.equal(null);
    });

    it('returns not found on get when item expired', async () => {

        const client = new Catbox.Client(Redis);
        await client.start();

        const key = { id: 'x', segment: 'test' };
        await client.set(key, 'x', 1);

        await timeoutPromise(2);
        const result = await client.get(key);
        expect(result).to.equal(null);
    });

    it('returns error on set when using null key', async () => {

        const client = new Catbox.Client(Redis);
        await client.start();

        await expect((() => {

            return client.set(null, {}, 1000);
        })()).to.reject(Error);
    });

    it('returns error on get when using invalid key', async () => {

        const client = new Catbox.Client(Redis);
        await client.start();

        await expect((() => {

            return client.get({});
        })()).to.reject(Error);
    });

    it('returns error on drop when using invalid key', async () => {

        const client = new Catbox.Client(Redis);
        await client.start();

        await expect((() => {

            return client.drop({});
        })()).to.reject(Error);
    });

    it('returns error on set when using invalid key', async () => {

        const client = new Catbox.Client(Redis);
        await client.start();

        await expect((() => {

            return client.set({}, {}, 1000);
        })()).to.reject(Error);
    });

    it('ignores set when using non-positive ttl value', async () => {

        const client = new Catbox.Client(Redis);
        await client.start();
        const key = { id: 'x', segment: 'test' };
        await client.set(key, 'y', 0);
    });

    it('returns error on drop when using null key', async () => {

        const client = new Catbox.Client(Redis);
        await client.start();

        await expect((() => {

            return client.drop(null);
        })()).to.reject(Error);
    });

    it('returns error on get when stopped', async () => {

        const client = new Catbox.Client(Redis);
        await client.stop();

        const key = { id: 'x', segment: 'test' };
        await expect((() => {

            return client.connection.get(key);
        })()).to.reject(Error, 'Connection not started');
    });

    it('returns error on set when stopped', async () => {

        const client = new Catbox.Client(Redis);
        await client.stop();

        const key = { id: 'x', segment: 'test' };
        await expect((() => {

            return client.connection.set(key, 'y', 1);
        })()).to.reject(Error, 'Connection not started');
    });

    it('returns error on drop when stopped', async () => {

        const client = new Catbox.Client(Redis);
        await client.stop();

        const key = { id: 'x', segment: 'test' };
        await expect((async () => {

            await client.connection.drop(key);
        })()).to.reject(Error, 'Connection not started');
    });

    it('returns error on missing segment name', () => {

        const config = {
            expiresIn: 50000
        };
        const fn = () => {

            const client = new Catbox.Client(Redis);
            new Catbox.Policy(config, client, '');
        };
        expect(fn).to.throw(Error);
    });

    it('returns error on bad segment name', () => {

        const config = {
            expiresIn: 50000
        };
        const fn = () => {

            const client = new Catbox.Client(Redis);
            new Catbox.Policy(config, client, 'a\0b');
        };
        expect(fn).to.throw(Error);
    });

    it('returns error when cache item dropped while stopped', async () => {

        const client = new Catbox.Client(Redis);
        await client.stop();

        await expect((() => {

            return client.drop('a');
        })()).to.reject(Error);
    });

    describe('start()', () => {

        it('sets client to when the connection succeeds', async () => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);

            await redis.start();
            expect(redis.client).to.exist();
        });

        it('reuses the client when a connection is already started', async () => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);

            await redis.start();
            const client = redis.client;

            await redis.start();
            expect(client).to.equal(redis.client);
        });

        it('returns an error when connection fails', async () => {

            const options = {
                host: '127.0.0.1',
                port: 6380
            };

            const redis = new Redis(options);

            await expect((() => {

                return redis.start();
            })()).to.reject(Error);

            expect(redis.client).to.not.exist();
        });

        it('sends auth command when password is provided', async () => {

            const options = {
                host: '127.0.0.1',
                port: 6379,
                password: 'wrongpassword'
            };

            const redis = new Redis(options);

            const warn = console.warn;
            let consoleMessage = '';
            console.warn = function (message) {

                consoleMessage += message;
            };

            await redis.start();

            console.warn = warn;
            expect(consoleMessage).to.contain('Redis server does not require a password, but a password was supplied.');
        });

        it('fails in error when auth is not correct', async () => {

            const options = {
                host: '127.0.0.1',
                port: 6378,
                password: 'foo'
            };

            const redis = new Redis(options);

            await expect((() => {

                return redis.start();
            })()).to.reject(Error);

            expect(redis.client).to.not.exist();
        });

        it('success when auth is correct', async () => {

            const options = {
                host: '127.0.0.1',
                port: 6378,
                password: 'secret'
            };

            const redis = new Redis(options);

            await redis.start();
            expect(redis.client).to.exist();
        });

        it('sends select command when database is provided', async () => {

            const options = {
                host: '127.0.0.1',
                port: 6379,
                database: 1
            };

            const redis = new Redis(options);

            await redis.start();
            expect(redis.client).to.exist();
        });

        it('sends select command when database is provided under "db" key', async () => {

            const options = {
                host: '127.0.0.1',
                port: 6379,
                db: 1
            };

            const redis = new Redis(options);

            await redis.start();
            expect(redis.client).to.exist();
        });

        it('connects to a unix domain socket when one is provided.', async () => {

            const options = {
                socket: '/tmp/redis.sock'
            };

            const redis = new Redis(options);

            await redis.start();
            expect(redis.client).to.exist();
        });

        it('connects via a Redis URL when one is provided.', async () => {

            const options = {
                url: 'redis://127.0.0.1:6379'
            };

            const redis = new Redis(options);

            await redis.start();
            expect(redis.client).to.exist();
        });

        describe('', () => {

            const oldCreateClient = RedisClient.createClient;
            before(() => {

                return new Promise((resolve, reject) => {

                    RedisClient.createClient = function (opts) {

                        const out = new EventEmitter();
                        process.nextTick(() => {


                            out.emit('ready');
                            out.removeAllListeners();
                        });
                        out.callArgs = opts;
                        return out;
                    };
                    resolve();
                });
            });

            after(() => {

                RedisClient.createClient = oldCreateClient;
            });

            it('connects to a sentinel cluster.', async () => {

                const options = {
                    sentinels: [
                        {
                            host: '127.0.0.1',
                            port: 26379
                        },
                        {
                            host: '127.0.0.2',
                            port: 26379
                        }
                    ],
                    sentinelName: 'mymaster'
                };

                const redis = new Redis(options);

                await redis.start();
                const client = redis.client;
                expect(client).to.exist();
                expect(client.callArgs.sentinels).to.equal(options.sentinels);
                expect(client.callArgs.name).to.equal(options.sentinelName);
            });
        });

        it('does not stops the client on error post connection', async () => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);

            await redis.start();
            expect(redis.client).to.exist();

            redis.client.emit('error', new Error('injected'));
            expect(redis.client).to.exist();
        });
    });

    describe('isReady()', () => {

        it('returns true when when connected', async () => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);

            await redis.start();
            expect(redis.client).to.exist();
            expect(redis.isReady()).to.equal(true);
            await redis.stop();
        });

        it('returns false when stopped', async () => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);

            await redis.start();
            expect(redis.client).to.exist();
            expect(redis.isReady()).to.equal(true);
            await redis.stop();
            expect(redis.isReady()).to.equal(false);
        });
    });

    describe('validateSegmentName()', () => {

        it('returns an error when the name is empty', () => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);

            const result = redis.validateSegmentName('');

            expect(result).to.be.instanceOf(Error);
            expect(result.message).to.equal('Empty string');
        });

        it('returns an error when the name has a null character', () => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);

            const result = redis.validateSegmentName('\0test');

            expect(result).to.be.instanceOf(Error);
        });

        it('returns null when there aren\'t any errors', () => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);

            const result = redis.validateSegmentName('valid');

            expect(result).to.not.be.instanceOf(Error);
            expect(result).to.equal(null);
        });
    });

    describe('get()', () => {

        it('returns a promise that rejects when the connection is closed', async () => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);

            await expect((async () => {

                await redis.get('test');
            })()).to.reject(Error, 'Connection not started');
        });

        it('returns a promise that rejects when there is an error returned from getting an item', async () => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);
            redis.client = {
                get: function (item) {

                    return Promise.reject(Error());
                }
            };

            await expect((() => {

                return redis.get('test');
            })()).to.reject(Error);
        });

        it('returns a promise that rejects when there is an error parsing the result', async () => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);
            redis.client = {

                get: function (item) {

                    return Promise.resolve('test');
                }
            };

            await expect((() => {

                return redis.get('test');
            })()).to.reject(Error, 'Bad envelope content');
        });

        it('returns a promise that rejects when there is an error with the envelope structure (stored)', async () => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);
            redis.client = {
                get: function (item) {

                    return Promise.resolve('{ "item": "false" }');
                }
            };

            await expect((() => {

                return redis.get('test');
            })()).to.reject(Error, 'Incorrect envelope structure');
        });

        it('returns a promise that rejects when there is an error with the envelope structure (item)', async () => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);
            redis.client = {
                get: function (item) {

                    return Promise.resolve('{ "stored": "123" }');
                }
            };

            await expect((() => {

                return redis.get('test');
            })()).to.reject(Error, 'Incorrect envelope structure');
        });

        it('is able to retrieve an object thats stored when connection is started', async () => {

            const options = {
                host: '127.0.0.1',
                port: 6379,
                partition: 'wwwtest'
            };
            const key = {
                id: 'test',
                segment: 'test'
            };

            const redis = new Redis(options);
            await redis.start();
            await redis.set(key, 'myvalue', 200);
            const result = await redis.get(key);
            expect(result.item).to.equal('myvalue');
        });

        it('returns null when unable to find the item', async () => {

            const options = {
                host: '127.0.0.1',
                port: 6379,
                partition: 'wwwtest'
            };
            const key = {
                id: 'notfound',
                segment: 'notfound'
            };

            const redis = new Redis(options);
            await redis.start();
            const result = await redis.get(key);
            expect(result).to.not.exist();
        });

        it('can store and retrieve falsy values such as int 0', async () => {

            const options = {
                host: '127.0.0.1',
                port: 6379,
                partition: 'wwwtest'
            };
            const key = {
                id: 'test',
                segment: 'test'
            };

            const redis = new Redis(options);
            await redis.start();
            await redis.set(key, 0, 200);
            const result = await redis.get(key);
            expect(result.item).to.equal(0);
        });
    });

    describe('set()', () => {

        it('returns a promise that rejects when the connection is closed', async () => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);

            await expect((async () => {

                await redis.set('test1', 'test1', 3600);
            })()).to.reject(Error, 'Connection not started');
        });

        it('returns a promise that rejects when there is an error returned from setting an item', async () => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);
            redis.client = {
                set: function (key, item, callback) {

                    return Promise.reject(Error());
                }
            };

            await expect((() => {

                return redis.set('test', 'test', 3600);
            })()).to.reject(Error);
        });
    });

    describe('drop()', () => {

        it('returns a promise that rejects when the connection is closed', async () => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);

            await expect((async () => {

                await redis.drop('test2');
            })()).to.reject(Error, 'Connection not started');
        });

        it('deletes the item from redis', async () => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);
            redis.client = {
                del: function (key) {

                    return Promise.resolve(null);
                }
            };

            await redis.drop('test');
        });
    });

    describe('generateKey()', () => {

        it('generates the storage key from a given catbox key', () => {

            const options = {
                partition: 'foo'
            };

            const redis = new Redis(options);

            const key = {
                id: 'bar',
                segment: 'baz'
            };

            expect(redis.generateKey(key)).to.equal('foo:baz:bar');
        });

        it('generates the storage key from a given catbox key without partition', () => {

            const options = {};

            const redis = new Redis(options);

            const key = {
                id: 'bar',
                segment: 'baz'
            };

            expect(redis.generateKey(key)).to.equal('baz:bar');
        });
    });

    describe('stop()', () => {

        it('sets the client to null', async () => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);

            await redis.start();
            expect(redis.client).to.exist();
            await redis.stop();
            expect(redis.client).to.not.exist();
        });
    });
});
