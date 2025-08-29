'use strict';

const Net = require('net');

const IoRedis = require('ioredis');
const Catbox = require('@hapi/catbox');
const Hoek = require('@hapi/hoek');
const Mock = require('./mock');
const { Engine: CatboxRedis } = require('..');

const Code = require('@hapi/code');
const Lab = require('@hapi/lab');

const internals = {};

const { it, describe } = exports.lab = Lab.script();
const expect = Code.expect;

const configs = [
    ['redis', {
        nopass: {
            host: '127.0.0.1',
            port: 6379
        },
        withpass: {
            host: '127.0.0.1',
            port: 6378,
            password: 'secret'
        }
    }],
    ['dragonfly', {
        nopass: {
            host: '127.0.0.1',
            port: 6377
        },
        withpass: {
            host: '127.0.0.1',
            port: 6376,
            password: 'secret'
        }
    }],
    ['valkey', {
        nopass: {
            host: '127.0.0.1',
            port: 6375
        },
        withpass: {
            host: '127.0.0.1',
            port: 6374,
            password: 'secret'
        }
    }]
];

describe('Connection', { retry: true }, () => {

    it('creates a new connection', async () => {

        const client = new Catbox.Client(CatboxRedis);
        await client.start();
        expect(client.isReady()).to.equal(true);
    });

    it('closes the connection', async () => {

        const client = new Catbox.Client(CatboxRedis);
        await client.start();
        expect(client.isReady()).to.equal(true);
        await client.stop();
        expect(client.isReady()).to.equal(false);
    });

    it('allow passing client in option', () => {

        return new Promise((resolve, reject) => {

            const redisClient = IoRedis.createClient();

            let getCalled = false;
            const _get = redisClient.get;
            redisClient.get = function (...args) {

                getCalled = true;
                return _get.apply(redisClient, args);
            };

            redisClient.on('error', reject);
            redisClient.once('ready', async () => {

                const client = new Catbox.Client(CatboxRedis, {
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

        const redisClient = IoRedis.createClient();

        await new Promise((resolve, reject) => {

            redisClient.once('error', reject);
            redisClient.once('ready', resolve);
        });

        const client = new Catbox.Client(CatboxRedis, { client: redisClient });
        await client.start();
        expect(client.isReady()).to.equal(true);
        await client.stop();
        expect(client.isReady()).to.equal(false);
        expect(redisClient.status).to.equal('ready');
        await redisClient.quit();
    });

    for (const [name, config] of configs) {

        it(`${name}: gets an item after setting it`, async () => {

            const client = new Catbox.Client(new CatboxRedis(config.nopass));
            await client.start();

            const key = { id: 'x', segment: 'test' };
            await client.set(key, '123', 500);

            const result = await client.get(key);
            expect(result.item).to.equal('123');
        });

        it(`${name}: fails setting an item circular references`, async () => {

            const client = new Catbox.Client(new CatboxRedis(config.nopass));
            await client.start();
            const key = { id: 'x', segment: 'test' };
            const value = { a: 1 };
            value.b = value;

            await expect(client.set(key, value, 10)).to.reject(/Converting circular structure to JSON/);
        });

        it(`${name}: ignored starting a connection twice on same event`, () => {

            return new Promise((resolve, reject) => {

                const client = new Catbox.Client(new CatboxRedis(config.nopass));
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

        it(`${name}: ignored starting a connection twice chained`, async () => {

            const client = new Catbox.Client(new CatboxRedis(config.nopass));

            await client.start();
            expect(client.isReady()).to.equal(true);

            await client.start();
            expect(client.isReady()).to.equal(true);
        });

        it(`${name}: returns not found on get when using null key`, async () => {

            const client = new Catbox.Client(new CatboxRedis(config.nopass));
            await client.start();

            const result = await client.get(null);

            expect(result).to.equal(null);
        });

        it(`${name}: returns not found on get when item expired`, async () => {

            const client = new Catbox.Client(new CatboxRedis(config.nopass));
            await client.start();

            const key = { id: 'x', segment: 'test' };
            await client.set(key, 'x', 1);

            await Hoek.wait(2);
            const result = await client.get(key);
            expect(result).to.equal(null);
        });

        it(`${name}: errors on set when using null key`, async () => {

            const client = new Catbox.Client(new CatboxRedis(config.nopass));
            await client.start();

            await expect(client.set(null, {}, 1000)).to.reject();
        });

        it(`${name}: errors on get when using invalid key`, async () => {

            const client = new Catbox.Client(new CatboxRedis(config.nopass));
            await client.start();

            await expect(client.get({})).to.reject();
        });

        it(`${name}: errors on drop when using invalid key`, async () => {

            const client = new Catbox.Client(new CatboxRedis(config.nopass));
            await client.start();

            await expect(client.drop({})).to.reject();
        });

        it(`${name}: errors on set when using invalid key`, async () => {

            const client = new Catbox.Client(new CatboxRedis(config.nopass));
            await client.start();

            await expect(client.set({}, {}, 1000)).to.reject();
        });

        it(`${name}: ignores set when using non-positive ttl value`, async () => {

            const client = new Catbox.Client(new CatboxRedis(config.nopass));
            await client.start();
            const key = { id: 'x', segment: 'test' };
            await client.set(key, 'y', 0);
        });

        it(`${name}: errors on drop when using null key`, async () => {

            const client = new Catbox.Client(new CatboxRedis(config.nopass));
            await client.start();

            await expect(client.drop(null)).to.reject();
        });

        it(`${name}: errors on get when stopped`, async () => {

            const client = new Catbox.Client(new CatboxRedis(config.nopass));
            await client.stop();

            const key = { id: 'x', segment: 'test' };
            await expect(client.connection.get(key)).to.reject('Connection not started');
        });

        it(`${name}: errors on set when stopped`, async () => {

            const client = new Catbox.Client(new CatboxRedis(config.nopass));
            await client.stop();

            const key = { id: 'x', segment: 'test' };
            expect(() => client.connection.set(key, 'y', 1)).to.throw('Connection not started');
        });

        it(`${name}: errors on drop when stopped`, async () => {

            const client = new Catbox.Client(new CatboxRedis(config.nopass));
            await client.stop();

            const key = { id: 'x', segment: 'test' };

            try {
                await client.connection.drop(key);
            }
            catch (err) {
                expect(err.message).to.equal('Connection not started');
            }
        });

        it(`${name}: errors on missing segment name`, () => {

            const policyConfig = {
                expiresIn: 50000
            };
            const fn = () => {

                const client = new Catbox.Client(new CatboxRedis(config.nopass));
                new Catbox.Policy(policyConfig, client, '');
            };

            expect(fn).to.throw(Error);
        });

        it(`${name}: errors on bad segment name`, () => {

            const policyConfig = {
                expiresIn: 50000
            };
            const fn = () => {

                const client = new Catbox.Client(new CatboxRedis(config.nopass));
                new Catbox.Policy(policyConfig, client, 'a\0b');
            };

            expect(fn).to.throw(Error);
        });

        it(`${name}: errors when cache item dropped while stopped`, async () => {

            const client = new Catbox.Client(new CatboxRedis(config.nopass));
            await client.stop();

            await expect(client.drop('a')).to.reject();
        });

        describe(`${name}: start()`, () => {

            it('sets client to when the connection succeeds', async () => {

                const options = {
                    host: '127.0.0.1',
                    port: 6379
                };

                const redis = new CatboxRedis(options);

                await redis.start();
                expect(redis.client).to.exist();
            });

            it('reuses the client when a connection is already started', async () => {

                const options = {
                    host: '127.0.0.1',
                    port: 6379
                };

                const redis = new CatboxRedis(options);

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

                const redis = new CatboxRedis(options);

                await expect(redis.start()).to.reject();

                expect(redis.client).to.not.exist();
            });

            it('sends auth command when password is provided', async () => {

                if (name === 'dragonfly') {

                    // When testing: connect with password when none is required
                    // Dragonfly won't cause ioredis to trigger the console.warn message.
                    // This test is not critical for functionality
                    return true;
                }

                const options = {
                    ...config.nopass,
                    password: 'wrongpassword'
                };

                const redis = new CatboxRedis(options);

                const warn = console.warn;
                let consoleMessage = '';
                console.warn = function (message) {

                    consoleMessage += message;
                };

                await redis.start();

                console.warn = warn;
                expect(consoleMessage).to.contain('does not require a password, but a password was supplied');
            });

            it('fails in error when auth is not correct', async () => {

                const options = {
                    ...config.withpass,
                    password: 'foo'
                };

                const redis = new CatboxRedis(options);

                const start = redis.start();
                console.log(start);

                await expect(start).to.reject();

                expect(redis.client).to.not.exist();
            });

            it('success when auth is correct', async () => {

                const options = {
                    ...config.withpass
                };

                const redis = new CatboxRedis(options);

                await redis.start();
                expect(redis.client).to.exist();
            });

            it('sends select command when database is provided', async () => {

                const options = {
                    host: '127.0.0.1',
                    port: 6379,
                    database: 1
                };

                const redis = new CatboxRedis(options);

                await redis.start();
                expect(redis.client).to.exist();
            });

            it('connects to a unix domain socket when one is provided', () => {

                const socketPath = '/tmp/catbox-redis.sock';
                const promise = new Promise((resolve, reject) => {

                    let connected = false;
                    const server = new Net.createServer((socket) => {

                        connected = true;
                        socket.destroy();
                    });

                    server.once('error', reject);
                    server.listen(socketPath, async () => {

                        const redis = new CatboxRedis({ socket: socketPath });
                        await expect(redis.start()).to.reject('Connection is closed.');
                        expect(connected).to.equal(true);
                        server.close(resolve);
                    });
                });

                return promise;
            });

            it('connects via a Redis URL when one is provided', async () => {

                const options = {
                    url: 'redis://127.0.0.1:6379'
                };

                const redis = new CatboxRedis(options);

                await redis.start();
                expect(redis.client).to.exist();
            });

            it('connects to a sentinel cluster', async () => {

                const sentinel = new Mock(27379, (argv) => {

                    if (argv[0] === 'sentinel' && argv[1] === 'get-master-addr-by-name') {
                        return ['127.0.0.1', '6379'];
                    }
                });

                sentinel.once('connect', () => {

                    sentinel.disconnect();
                });

                const options = {
                    sentinels: [
                        {
                            host: '127.0.0.1',
                            port: 27379
                        },
                        {
                            host: '127.0.0.2',
                            port: 27379
                        }
                    ],
                    sentinelName: 'mymaster'
                };

                const redis = new CatboxRedis(options);

                await redis.start();
                const client = redis.client;
                expect(client).to.exist();
                expect(client.connector.options.sentinels).to.equal(options.sentinels);
                expect(client.connector.options.name).to.equal(options.sentinelName);
            });

            it('does not stops the client on error post connection', async () => {

                const options = {
                    host: '127.0.0.1',
                    port: 6379
                };

                const redis = new CatboxRedis(options);

                await redis.start();
                expect(redis.client).to.exist();

                redis.client.emit('error', new Error('injected'));
                expect(redis.client).to.exist();
            });
        });

        describe(`${name}: isReady()`, () => {

            it('returns true when when connected', async () => {

                const options = {
                    host: '127.0.0.1',
                    port: 6379
                };

                const redis = new CatboxRedis(options);

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

                const redis = new CatboxRedis(options);

                await redis.start();
                expect(redis.client).to.exist();
                expect(redis.isReady()).to.equal(true);
                await redis.stop();
                expect(redis.isReady()).to.equal(false);
            });
        });

        describe(`${name}: validateSegmentName()`, () => {

            it('returns an error when the name is empty', () => {

                const options = {
                    host: '127.0.0.1',
                    port: 6379
                };

                const redis = new CatboxRedis(options);

                const result = redis.validateSegmentName('');

                expect(result).to.be.instanceOf(Error);
                expect(result.message).to.equal('Empty string');
            });

            it('returns an error when the name has a null character', () => {

                const options = {
                    host: '127.0.0.1',
                    port: 6379
                };

                const redis = new CatboxRedis(options);

                const result = redis.validateSegmentName('\0test');

                expect(result).to.be.instanceOf(Error);
            });

            it('returns null when there aren\'t any errors', () => {

                const options = {
                    host: '127.0.0.1',
                    port: 6379
                };

                const redis = new CatboxRedis(options);

                const result = redis.validateSegmentName('valid');

                expect(result).to.not.be.instanceOf(Error);
                expect(result).to.equal(null);
            });
        });

        describe(`${name}: get()`, () => {

            it('returns a promise that rejects when the connection is closed', async () => {

                const options = {
                    host: '127.0.0.1',
                    port: 6379
                };

                const redis = new CatboxRedis(options);

                try {
                    await redis.get('test');
                }
                catch (err) {
                    expect(err.message).to.equal('Connection not started');
                }
            });

            it('returns a promise that rejects when there is an error returned from getting an item', async () => {

                const options = {
                    host: '127.0.0.1',
                    port: 6379
                };

                const redis = new CatboxRedis(options);
                redis.client = {
                    get: function (item) {

                        return Promise.reject(Error());
                    }
                };

                await expect(redis.get('test')).to.reject();
            });

            it('returns a promise that rejects when there is an error parsing the result', async () => {

                const options = {
                    host: '127.0.0.1',
                    port: 6379
                };

                const redis = new CatboxRedis(options);
                redis.client = {

                    get: function (item) {

                        return Promise.resolve('test');
                    }
                };

                await expect(redis.get('test')).to.reject('Bad envelope content');
            });

            it('returns a promise that rejects when there is an error with the envelope structure (stored)', async () => {

                const options = {
                    host: '127.0.0.1',
                    port: 6379
                };

                const redis = new CatboxRedis(options);
                redis.client = {
                    get: function (item) {

                        return Promise.resolve('{ "item": "false" }');
                    }
                };

                await expect(redis.get('test')).to.reject('Incorrect envelope structure');
            });

            it('returns a promise that rejects when there is an error with the envelope structure (item)', async () => {

                const options = {
                    host: '127.0.0.1',
                    port: 6379
                };

                const redis = new CatboxRedis(options);
                redis.client = {
                    get: function (item) {

                        return Promise.resolve('{ "stored": "123" }');
                    }
                };

                await expect(redis.get('test')).to.reject('Incorrect envelope structure');
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

                const redis = new CatboxRedis(options);
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

                const redis = new CatboxRedis(options);
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

                const redis = new CatboxRedis(options);
                await redis.start();
                await redis.set(key, 0, 200);
                const result = await redis.get(key);
                expect(result.item).to.equal(0);
            });

            it('can store and retrieve falsy values such as boolean false', async () => {

                const options = {
                    host: '127.0.0.1',
                    port: 6379,
                    partition: 'wwwtest'
                };
                const key = {
                    id: 'test',
                    segment: 'test'
                };

                const redis = new CatboxRedis(options);
                await redis.start();
                await redis.set(key, false, 200);
                const result = await redis.get(key);
                expect(result.item).to.equal(false);
            });
        });

        describe(`${name}: set()`, () => {

            it('returns a promise that rejects when the connection is closed', async () => {

                const options = {
                    host: '127.0.0.1',
                    port: 6379
                };

                const redis = new CatboxRedis(options);

                try {
                    await redis.set('test1', 'test1', 3600);
                }
                catch (err) {
                    expect(err.message).to.equal('Connection not started');
                }
            });

            it('returns a promise that rejects when there is an error returned from setting an item', async () => {

                const options = {
                    host: '127.0.0.1',
                    port: 6379
                };

                const redis = new CatboxRedis(options);
                redis.client = {
                    psetex: function (key, ttls, value) {

                        return Promise.reject(Error());
                    }
                };

                await expect(redis.set('test', 'test', 3600)).to.reject();
            });
        });

        describe(`${name}: drop()`, () => {

            it('returns a promise that rejects when the connection is closed', async () => {

                const options = {
                    host: '127.0.0.1',
                    port: 6379
                };

                const redis = new CatboxRedis(options);

                try {
                    await redis.drop('test2');
                }
                catch (err) {
                    expect(err.message).to.equal('Connection not started');
                }
            });

            it('deletes the item from redis', async () => {

                const options = {
                    host: '127.0.0.1',
                    port: 6379
                };

                const redis = new CatboxRedis(options);
                redis.client = {
                    del: function (key) {

                        return Promise.resolve(null);
                    }
                };

                await redis.drop('test');
            });
        });

        describe(`${name}: generateKey()`, () => {

            it('generates the storage key from a given catbox key', () => {

                const options = {
                    partition: 'foo'
                };

                const redis = new CatboxRedis(options);

                const key = {
                    id: 'bar',
                    segment: 'baz'
                };

                expect(redis.generateKey(key)).to.equal('foo:baz:bar');
            });

            it('generates the storage key from a given catbox key without partition', () => {

                const options = {};

                const redis = new CatboxRedis(options);

                const key = {
                    id: 'bar',
                    segment: 'baz'
                };

                expect(redis.generateKey(key)).to.equal('baz:bar');
            });
        });

        describe(`${name}: stop()`, () => {

            it('sets the client to null', async () => {

                const options = {
                    host: '127.0.0.1',
                    port: 6379
                };

                const redis = new CatboxRedis(options);

                await redis.start();
                expect(redis.client).to.exist();
                await redis.stop();
                expect(redis.client).to.not.exist();
            });
        });
    }
});


