
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


describe('Redis', () => {

    it('throws an error if not created with new', (done) => {

        const fn = () => {

            Redis();
        };

        expect(fn).to.throw(Error);
        done();
    });

    it('creates a new connection', (done) => {

        const client = new Catbox.Client(Redis);
        client.start((err) => {

            expect(client.isReady()).to.equal(true);
            done(err);
        });
    });

    it('closes the connection', (done) => {

        const client = new Catbox.Client(Redis);
        client.start((err) => {

            expect(err).to.not.exist();
            expect(client.isReady()).to.equal(true);
            client.stop();
            expect(client.isReady()).to.equal(false);
            done();
        });
    });

    it('allow passing client in option', (done) => {

        const redisClient = RedisClient.createClient();

        let getCalled = false;
        const _get = redisClient.get;
        redisClient.get = function (key, callback) {

            getCalled = true;
            return _get.apply(redisClient, arguments);
        };

        redisClient.on('error', done);
        redisClient.once('ready', () => {

            const client = new Catbox.Client(Redis, {
                client: redisClient
            });
            client.start((err) => {

                expect(err).to.not.exist();
                expect(client.isReady()).to.equal(true);
                const key = { id: 'x', segment: 'test' };
                client.get(key, (err, result) => {

                    expect(err).to.equal(null);
                    expect(getCalled).to.equal(true);
                    done();
                });
            });
        });
    });

    it('gets an item after setting it', (done) => {

        const client = new Catbox.Client(Redis);
        client.start((err) => {

            expect(err).to.not.exist();
            const key = { id: 'x', segment: 'test' };
            client.set(key, '123', 500, (err) => {

                expect(err).to.not.exist();
                client.get(key, (err, result) => {

                    expect(err).to.equal(null);
                    expect(result.item).to.equal('123');
                    done();
                });
            });
        });
    });

    it('fails setting an item circular references', (done) => {

        const client = new Catbox.Client(Redis);
        client.start((err) => {

            expect(err).to.not.exist();
            const key = { id: 'x', segment: 'test' };
            const value = { a: 1 };
            value.b = value;
            client.set(key, value, 10, (err) => {

                expect(err.message).to.equal('Converting circular structure to JSON');
                done();
            });
        });
    });

    it('ignored starting a connection twice on same event', (done) => {

        const client = new Catbox.Client(Redis);
        let x = 2;
        const start = () => {

            client.start((err) => {

                expect(err).to.not.exist();
                expect(client.isReady()).to.equal(true);
                --x;
                if (!x) {
                    done();
                }
            });
        };

        start();
        start();
    });

    it('ignored starting a connection twice chained', (done) => {

        const client = new Catbox.Client(Redis);
        client.start((err) => {

            expect(err).to.not.exist();
            expect(client.isReady()).to.equal(true);

            client.start((err) => {

                expect(err).to.not.exist();
                expect(client.isReady()).to.equal(true);
                done();
            });
        });
    });

    it('returns not found on get when using null key', (done) => {

        const client = new Catbox.Client(Redis);
        client.start((err) => {

            expect(err).to.not.exist();
            client.get(null, (err, result) => {

                expect(err).to.equal(null);
                expect(result).to.equal(null);
                done();
            });
        });
    });

    it('returns not found on get when item expired', (done) => {

        const client = new Catbox.Client(Redis);
        client.start((err) => {

            expect(err).to.not.exist();
            const key = { id: 'x', segment: 'test' };
            client.set(key, 'x', 1, (err) => {

                expect(err).to.not.exist();
                setTimeout(() => {

                    client.get(key, (err, result) => {

                        expect(err).to.equal(null);
                        expect(result).to.equal(null);
                        done();
                    });
                }, 2);
            });
        });
    });

    it('returns error on set when using null key', (done) => {

        const client = new Catbox.Client(Redis);
        client.start((err) => {

            expect(err).to.not.exist();
            client.set(null, {}, 1000, (err) => {

                expect(err instanceof Error).to.equal(true);
                done();
            });
        });
    });

    it('returns error on get when using invalid key', (done) => {

        const client = new Catbox.Client(Redis);
        client.start((err) => {

            expect(err).to.not.exist();
            client.get({}, (err) => {

                expect(err instanceof Error).to.equal(true);
                done();
            });
        });
    });

    it('returns error on drop when using invalid key', (done) => {

        const client = new Catbox.Client(Redis);
        client.start((err) => {

            expect(err).to.not.exist();
            client.drop({}, (err) => {

                expect(err instanceof Error).to.equal(true);
                done();
            });
        });
    });

    it('returns error on set when using invalid key', (done) => {

        const client = new Catbox.Client(Redis);
        client.start((err) => {

            expect(err).to.not.exist();
            client.set({}, {}, 1000, (err) => {

                expect(err instanceof Error).to.equal(true);
                done();
            });
        });
    });

    it('ignores set when using non-positive ttl value', (done) => {

        const client = new Catbox.Client(Redis);
        client.start((err) => {

            expect(err).to.not.exist();
            const key = { id: 'x', segment: 'test' };
            client.set(key, 'y', 0, (err) => {

                expect(err).to.not.exist();
                done();
            });
        });
    });

    it('returns error on drop when using null key', (done) => {

        const client = new Catbox.Client(Redis);
        client.start((err) => {

            expect(err).to.not.exist();
            client.drop(null, (err) => {

                expect(err instanceof Error).to.equal(true);
                done();
            });
        });
    });

    it('returns error on get when stopped', (done) => {

        const client = new Catbox.Client(Redis);
        client.stop();
        const key = { id: 'x', segment: 'test' };
        client.connection.get(key, (err, result) => {

            expect(err).to.exist();
            expect(result).to.not.exist();
            done();
        });
    });

    it('returns error on set when stopped', (done) => {

        const client = new Catbox.Client(Redis);
        client.stop();
        const key = { id: 'x', segment: 'test' };
        client.connection.set(key, 'y', 1, (err) => {

            expect(err).to.exist();
            done();
        });
    });

    it('returns error on drop when stopped', (done) => {

        const client = new Catbox.Client(Redis);
        client.stop();
        const key = { id: 'x', segment: 'test' };
        client.connection.drop(key, (err) => {

            expect(err).to.exist();
            done();
        });
    });

    it('returns error on missing segment name', (done) => {

        const config = {
            expiresIn: 50000
        };
        const fn = () => {

            const client = new Catbox.Client(Redis);
            new Catbox.Policy(config, client, '');
        };
        expect(fn).to.throw(Error);
        done();
    });

    it('returns error on bad segment name', (done) => {

        const config = {
            expiresIn: 50000
        };
        const fn = () => {

            const client = new Catbox.Client(Redis);
            new Catbox.Policy(config, client, 'a\0b');
        };
        expect(fn).to.throw(Error);
        done();
    });

    it('returns error when cache item dropped while stopped', (done) => {

        const client = new Catbox.Client(Redis);
        client.stop();
        client.drop('a', (err) => {

            expect(err).to.exist();
            done();
        });
    });

    describe('start()', () => {

        it('sets client to when the connection succeeds', (done) => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);

            redis.start((err) => {

                expect(err).to.not.exist();
                expect(redis.client).to.exist();
                done();
            });
        });

        it('reuses the client when a connection is already started', (done) => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);

            redis.start((err) => {

                expect(err).to.not.exist();
                const client = redis.client;

                redis.start(() => {

                    expect(client).to.equal(redis.client);
                    done();
                });
            });
        });

        it('returns an error when connection fails', (done) => {

            const options = {
                host: '127.0.0.1',
                port: 6380
            };

            const redis = new Redis(options);

            redis.start((err) => {

                expect(err).to.exist();
                expect(err).to.be.instanceOf(Error);
                expect(redis.client).to.not.exist();
                done();
            });
        });

        it('sends auth command when password is provided', (done) => {

            const options = {
                host: '127.0.0.1',
                port: 6379,
                password: 'wrongpassword'
            };

            const redis = new Redis(options);

            const log = console.log;
            console.log = function (message) {

                expect(message).to.contain('Warning');
                console.log = log;
            };

            redis.start((err) => {

                expect(err).to.not.exist();
                done();
            });
        });

        it('fails in error when auth is not correct', (done) => {

            const options = {
                host: '127.0.0.1',
                port: 6378,
                password: 'foo'
            };

            const redis = new Redis(options);

            redis.start((err) => {

                expect(err).to.exist();
                expect(err).to.be.instanceOf(Error);
                expect(redis.client).to.not.exist();
                done();
            });
        });

        it('success when auth is correct', (done) => {

            const options = {
                host: '127.0.0.1',
                port: 6378,
                password: 'secret'
            };

            const redis = new Redis(options);

            redis.start(done);
        });

        it('sends select command when database is provided', (done) => {

            const options = {
                host: '127.0.0.1',
                port: 6379,
                database: 1
            };

            const redis = new Redis(options);

            redis.start(() => {

                done();

            });
        });

        it('connects to a unix domain socket when one is provided.', (done) => {

            const options = {
                socket: '/tmp/redis.sock'
            };

            const redis = new Redis(options);

            redis.start((err) => {

                expect(err).to.not.exist();
                const client = redis.client;
                expect(client).to.exist();
                done();
            });
        });

        it('connects via a Redis URL when one is provided.', (done) => {

            const options = {
                url: 'redis://127.0.0.1:6379'
            };

            const redis = new Redis(options);

            redis.start((err) => {

                expect(err).to.not.exist();
                const client = redis.client;
                expect(client).to.exist();
                done();
            });
        });

        describe('', () => {

            const oldCreateClient = RedisClient.createClient;
            before((done) => {

                RedisClient.createClient = function (opts) {

                    const out = new EventEmitter();
                    process.nextTick(() => {

                        out.emit('ready');
                        out.removeAllListeners();
                    });
                    out.callArgs = opts;
                    return out;
                };
                done();
            });

            after((done) => {

                RedisClient.createClient = oldCreateClient;
                done();
            });

            it('connects to a sentinel cluster.', (done) => {

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

                redis.start((err) => {

                    expect(err).to.not.exist();
                    const client = redis.client;
                    expect(client).to.exist();
                    expect(client.callArgs.sentinels).to.equal(options.sentinels);
                    expect(client.callArgs.name).to.equal(options.sentinelName);
                    done();
                });
            });
        });

        it('does not stops the client on error post connection', (done) => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);

            redis.start((err) => {

                expect(err).to.not.exist();
                expect(redis.client).to.exist();

                redis.client.emit('error', new Error('injected'));
                expect(redis.client).to.exist();
                done();
            });
        });
    });

    describe('isReady()', () => {

        it('returns true when when connected', (done) => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);

            redis.start((err) => {

                expect(err).to.not.exist();
                expect(redis.isReady()).to.equal(true);

                redis.stop();

                done();
            });
        });

        it('returns false when stopped', (done) => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);

            redis.start((err) => {

                expect(err).to.not.exist();
                expect(redis.isReady()).to.equal(true);

                redis.stop();

                expect(redis.isReady()).to.equal(false);

                done();
            });
        });
    });

    describe('validateSegmentName()', () => {

        it('returns an error when the name is empty', (done) => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);

            const result = redis.validateSegmentName('');

            expect(result).to.be.instanceOf(Error);
            expect(result.message).to.equal('Empty string');
            done();
        });

        it('returns an error when the name has a null character', (done) => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);

            const result = redis.validateSegmentName('\0test');

            expect(result).to.be.instanceOf(Error);
            done();
        });

        it('returns null when there aren\'t any errors', (done) => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);

            const result = redis.validateSegmentName('valid');

            expect(result).to.not.be.instanceOf(Error);
            expect(result).to.equal(null);
            done();
        });
    });

    describe('get()', () => {

        it('passes an error to the callback when the connection is closed', (done) => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);

            redis.get('test', (err) => {

                expect(err).to.exist();
                expect(err).to.be.instanceOf(Error);
                expect(err.message).to.equal('Connection not started');
                done();
            });
        });

        it('passes an error to the callback when there is an error returned from getting an item', (done) => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);
            redis.client = {
                get: function (item, callback) {

                    callback(new Error());
                }
            };

            redis.get('test', (err) => {

                expect(err).to.exist();
                expect(err).to.be.instanceOf(Error);
                done();
            });
        });

        it('passes an error to the callback when there is an error parsing the result', (done) => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);
            redis.client = {
                get: function (item, callback) {

                    callback(null, 'test');
                }
            };

            redis.get('test', (err) => {

                expect(err).to.exist();
                expect(err.message).to.equal('Bad envelope content');
                done();
            });
        });

        it('passes an error to the callback when there is an error with the envelope structure (stored)', (done) => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);
            redis.client = {
                get: function (item, callback) {

                    callback(null, '{ "item": "false" }');
                }
            };

            redis.get('test', (err) => {

                expect(err).to.exist();
                expect(err.message).to.equal('Incorrect envelope structure');
                done();
            });
        });

        it('passes an error to the callback when there is an error with the envelope structure (item)', (done) => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);
            redis.client = {
                get: function (item, callback) {

                    callback(null, '{ "stored": "123" }');
                }
            };

            redis.get('test', (err) => {

                expect(err).to.exist();
                expect(err.message).to.equal('Incorrect envelope structure');
                done();
            });
        });

        it('is able to retrieve an object thats stored when connection is started', (done) => {

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

            redis.start(() => {

                redis.set(key, 'myvalue', 200, (err) => {

                    expect(err).to.not.exist();
                    redis.get(key, (err, result) => {

                        expect(err).to.not.exist();
                        expect(result.item).to.equal('myvalue');
                        done();
                    });
                });
            });
        });

        it('returns null when unable to find the item', (done) => {

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

            redis.start(() => {

                redis.get(key, (err, result) => {

                    expect(err).to.not.exist();
                    expect(result).to.not.exist();
                    done();
                });
            });
        });
    });

    describe('set()', () => {

        it('passes an error to the callback when the connection is closed', (done) => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);

            redis.set('test1', 'test1', 3600, (err) => {

                expect(err).to.exist();
                expect(err).to.be.instanceOf(Error);
                expect(err.message).to.equal('Connection not started');
                done();
            });
        });

        it('passes an error to the callback when there is an error returned from setting an item', (done) => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);
            redis.client = {
                set: function (key, item, callback) {

                    callback(new Error());
                }
            };

            redis.set('test', 'test', 3600, (err) => {

                expect(err).to.exist();
                expect(err).to.be.instanceOf(Error);
                done();
            });
        });
    });

    describe('drop()', () => {

        it('passes an error to the callback when the connection is closed', (done) => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);

            redis.drop('test2', (err) => {

                expect(err).to.exist();
                expect(err).to.be.instanceOf(Error);
                expect(err.message).to.equal('Connection not started');
                done();
            });
        });

        it('deletes the item from redis', (done) => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);
            redis.client = {
                del: function (key, callback) {

                    callback(null, null);
                }
            };

            redis.drop('test', (err) => {

                expect(err).to.not.exist();
                done();
            });
        });
    });

    describe('generateKey()', () => {

        it('generates the storage key from a given catbox key', (done) => {

            const options = {
                partition: 'foo'
            };

            const redis = new Redis(options);

            const key = {
                id: 'bar',
                segment: 'baz'
            };

            expect(redis.generateKey(key)).to.equal('foo:baz:bar');
            done();
        });

        it('generates the storage key from a given catbox key without partition', (done) => {

            const options = {};

            const redis = new Redis(options);

            const key = {
                id: 'bar',
                segment: 'baz'
            };

            expect(redis.generateKey(key)).to.equal('baz:bar');
            done();
        });
    });

    describe('stop()', () => {

        it('sets the client to null', (done) => {

            const options = {
                host: '127.0.0.1',
                port: 6379
            };

            const redis = new Redis(options);

            redis.start(() => {

                expect(redis.client).to.exist();
                redis.stop();
                expect(redis.client).to.not.exist();
                done();
            });
        });
    });
});
