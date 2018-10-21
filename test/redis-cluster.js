'use strict';

const Code = require('code');
const Lab = require('lab');
const RedisCluster = require('..').Cluster;
const Catbox = require('catbox');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const describe = lab.describe;
const it = lab.test;

const timeoutPromise = (timer) => {

    return new Promise((resolve) => {

        setTimeout(resolve, timer);
    });
};

describe('Redis Cluster', () => {

    it('throws an error if not created with new', () => {

        const fn = () => {

            RedisCluster();
        };

        expect(fn).to.throw(Error);
    });

    it('creates connection to multiple nodes', async () => {

        const connection = new RedisCluster([
            {
                host: '127.0.0.1',
                port: 7000
            },
            {
                host: '127.0.0.1',
                port: 7001
            },
            {
                host: '127.0.0.1',
                port: 7002
            }
        ]);
        await connection.start();
        expect(connection.isReady()).to.equal(true);
    });

    it('closes the connection', async () => {

        const connection = new RedisCluster([
            {
                host: '127.0.0.1',
                port: 7000
            }
        ]);

        const client = new Catbox.Client(connection);
        await client.start();
        expect(client.isReady()).to.equal(true);
        await client.stop();
        expect(client.isReady()).to.equal(false);
    });

    it('gets an item after setting it', async () => {

        const connection = new RedisCluster([
            {
                host: '127.0.0.1',
                port: 7000
            }
        ]);

        const client = new Catbox.Client(connection);
        await client.start();

        const key = { id: 'x', segment: 'test' };
        await client.set(key, '123', 500);

        const result = await client.get(key);
        expect(result.item).to.equal('123');
    });

    it('fails setting an item circular references', async () => {

        const connection = new RedisCluster([
            {
                host: '127.0.0.1',
                port: 7000
            }
        ]);

        const client = new Catbox.Client(connection);
        await client.start();
        const key = { id: 'x', segment: 'test' };
        const value = { a: 1 };
        value.b = value;

        await expect(client.set(key, value, 10)).to.reject(Error, 'Converting circular structure to JSON');
    });

    it('ignored starting a connection twice chained', async () => {

        const connection = new RedisCluster([
            {
                host: '127.0.0.1',
                port: 7000
            }
        ]);

        const client = new Catbox.Client(connection);

        await client.start();
        expect(client.isReady()).to.equal(true);

        await client.start();
        expect(client.isReady()).to.equal(true);
    });

    it('returns not found on get when using null key', async () => {

        const connection = new RedisCluster([
            {
                host: '127.0.0.1',
                port: 7000
            }
        ]);

        const client = new Catbox.Client(connection);
        await client.start();

        const result = await client.get(null);

        expect(result).to.equal(null);
    });

    it('returns not found on get when item expired', async () => {

        const connection = new RedisCluster([
            {
                host: '127.0.0.1',
                port: 7000
            }
        ]);

        const client = new Catbox.Client(connection);
        await client.start();

        const key = { id: 'x', segment: 'test' };
        await client.set(key, 'x', 1);

        await timeoutPromise(2);
        const result = await client.get(key);
        expect(result).to.equal(null);
    });

    it('returns error on set when using null key', async () => {

        const connection = new RedisCluster([
            {
                host: '127.0.0.1',
                port: 7000
            }
        ]);

        const client = new Catbox.Client(connection);
        await client.start();

        await expect(client.set(null, {}, 1000)).to.reject(Error);
    });

    it('returns error on get when using invalid key', async () => {

        const connection = new RedisCluster([
            {
                host: '127.0.0.1',
                port: 7000
            }
        ]);

        const client = new Catbox.Client(connection);
        await client.start();

        await expect(client.get({})).to.reject(Error);
    });

    it('returns error on drop when using invalid key', async () => {

        const connection = new RedisCluster([
            {
                host: '127.0.0.1',
                port: 7000
            }
        ]);

        const client = new Catbox.Client(connection);
        await client.start();

        await expect(client.drop({})).to.reject(Error);
    });

    it('returns error on set when using invalid key', async () => {

        const connection = new RedisCluster([
            {
                host: '127.0.0.1',
                port: 7000
            }
        ]);

        const client = new Catbox.Client(connection);
        await client.start();

        await expect(client.set({}, {}, 1000)).to.reject(Error);
    });

    it('ignores set when using non-positive ttl value', async () => {

        const connection = new RedisCluster([
            {
                host: '127.0.0.1',
                port: 7000
            }
        ]);

        const client = new Catbox.Client(connection);
        await client.start();
        const key = { id: 'x', segment: 'test' };
        await client.set(key, 'y', 0);
    });

    it('returns error on drop when using null key', async () => {

        const connection = new RedisCluster([
            {
                host: '127.0.0.1',
                port: 7000
            }
        ]);

        const client = new Catbox.Client(connection);
        await client.start();

        await expect(client.drop(null)).to.reject(Error);
    });

    it('returns error on get when stopped', async () => {

        const connection = new RedisCluster([
            {
                host: '127.0.0.1',
                port: 7000
            }
        ]);

        const client = new Catbox.Client(connection);
        await client.stop();

        const key = { id: 'x', segment: 'test' };
        await expect(client.connection.get(key)).to.reject(Error, 'Connection not started');
    });

    it('returns error on set when stopped', async () => {

        const connection = new RedisCluster([
            {
                host: '127.0.0.1',
                port: 7000
            }
        ]);

        const client = new Catbox.Client(connection);
        await client.stop();

        const key = { id: 'x', segment: 'test' };
        await expect(client.connection.set(key, 'y', 1)).to.reject(Error, 'Connection not started');
    });

    it('returns error on drop when stopped', async () => {

        const connection = new RedisCluster([
            {
                host: '127.0.0.1',
                port: 7000
            }
        ]);

        const client = new Catbox.Client(connection);
        await client.stop();

        const key = { id: 'x', segment: 'test' };

        try {
            await client.connection.drop(key);
        }
        catch (err) {
            expect(err.message).to.equal('Connection not started');
        }
    });

    it('returns error on missing segment name', () => {

        const config = {
            expiresIn: 50000
        };
        const fn = () => {

            const connection = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ]);

            const client = new Catbox.Client(connection);
            new Catbox.Policy(config, client, '');
        };

        expect(fn).to.throw(Error);
    });

    it('returns error on bad segment name', () => {

        const config = {
            expiresIn: 50000
        };
        const fn = () => {

            const connection = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ]);

            const client = new Catbox.Client(connection);
            new Catbox.Policy(config, client, 'a\0b');
        };

        expect(fn).to.throw(Error);
    });

    it('returns error when cache item dropped while stopped', async () => {

        const connection = new RedisCluster([
            {
                host: '127.0.0.1',
                port: 7000
            }
        ]);

        const client = new Catbox.Client(connection);
        await client.stop();

        await expect(client.drop('a')).to.reject(Error);
    });

    describe('start()', () => {

        it('sets client to when the connection succeeds', async () => {

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ]);

            await redisCluster.start();
            expect(redisCluster.client).to.exist();
        });

        it('returns an error when connection fails', async () => {

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.2',
                    port: 7000
                }
            ]);

            await expect(redisCluster.start()).to.reject(Error);
        });

        it('sends auth command when password is provided', async () => {

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ], {
                redisOptions: {
                    password: 'wrongpassword'
                }
            });

            const warn = console.warn;
            let consoleMessage = '';
            console.warn = function (message) {

                consoleMessage += message;
            };

            await redisCluster.start();

            console.warn = warn;
            expect(consoleMessage).to.contain('Redis server does not require a password, but a password was supplied.');
        });

        it('sends select command when database is provided', async () => {

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ], {
                redisOptions: {
                    database: 1
                }
            });

            await redisCluster.start();
            expect(redisCluster.client).to.exist();
        });
    });

    describe('', () => {

        it('does not stops the client on error post connection', async () => {

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ]);

            await redisCluster.start();
            expect(redisCluster.client).to.exist();

            redisCluster.client.emit('error', new Error('injected'));
            expect(redisCluster.client).to.exist();
        });
    });

    describe('isReady()', () => {

        it('returns true when when connected', async () => {

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ]);

            await redisCluster.start();
            expect(redisCluster.client).to.exist();
            expect(redisCluster.isReady()).to.equal(true);
            await redisCluster.stop();
        });

        it('returns false when stopped', async () => {

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ]);

            await redisCluster.start();
            expect(redisCluster.client).to.exist();
            expect(redisCluster.isReady()).to.equal(true);
            await redisCluster.stop();
            expect(redisCluster.isReady()).to.equal(false);
        });
    });

    describe('validateSegmentName()', () => {

        it('returns an error when the name is empty', () => {

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ]);

            const result = redisCluster.validateSegmentName('');

            expect(result).to.be.instanceOf(Error);
            expect(result.message).to.equal('Empty string');
        });

        it('returns an error when the name has a null character', () => {

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ]);

            const result = redisCluster.validateSegmentName('\0test');

            expect(result).to.be.instanceOf(Error);
        });

        it('returns null when there aren\'t any errors', () => {

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ]);

            const result = redisCluster.validateSegmentName('valid');

            expect(result).to.not.be.instanceOf(Error);
            expect(result).to.equal(null);
        });
    });

    describe('get()', () => {

        it('returns a promise that rejects when the connection is closed', async () => {

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ]);

            try {
                await redisCluster.get('test');
            }
            catch (err) {
                expect(err.message).to.equal('Connection not started');
            }
        });

        it('returns a promise that rejects when there is an error returned from getting an item', async () => {

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ]);
            redisCluster.client = {
                get: function (item) {

                    return Promise.reject(Error());
                }
            };

            await expect(redisCluster.get('test')).to.reject(Error);
        });

        it('returns a promise that rejects when there is an error parsing the result', async () => {

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ]);
            redisCluster.client = {

                get: function (item) {

                    return Promise.resolve('test');
                }
            };

            await expect(redisCluster.get('test')).to.reject(Error, 'Bad envelope content');
        });

        it('returns a promise that rejects when there is an error with the envelope structure (stored)', async () => {

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ]);
            redisCluster.client = {
                get: function (item) {

                    return Promise.resolve('{ "item": "false" }');
                }
            };

            await expect(redisCluster.get('test')).to.reject(Error, 'Incorrect envelope structure');
        });

        it('returns a promise that rejects when there is an error with the envelope structure (item)', async () => {

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ]);
            redisCluster.client = {
                get: function (item) {

                    return Promise.resolve('{ "stored": "123" }');
                }
            };

            await expect(redisCluster.get('test')).to.reject(Error, 'Incorrect envelope structure');
        });

        it('is able to retrieve an object thats stored when connection is started', async () => {

            const key = {
                id: 'test',
                segment: 'test'
            };

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ], {
                redisOptions: {
                    partition: 'wwwtest'
                }
            });
            await redisCluster.start();
            await redisCluster.set(key, 'myvalue', 200);
            const result = await redisCluster.get(key);
            expect(result.item).to.equal('myvalue');
        });

        it('returns null when unable to find the item', async () => {

            const key = {
                id: 'notfound',
                segment: 'notfound'
            };

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ], {
                redisOptions: {
                    partition: 'wwwtest'
                }
            });
            await redisCluster.start();
            const result = await redisCluster.get(key);
            expect(result).to.not.exist();
        });

        it('can store and retrieve falsy values such as int 0', async () => {

            const key = {
                id: 'test',
                segment: 'test'
            };

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ], {
                redisOptions: {
                    partition: 'wwwtest'
                }
            });
            await redisCluster.start();
            await redisCluster.set(key, 0, 200);
            const result = await redisCluster.get(key);
            expect(result.item).to.equal(0);
        });

        it('can store and retrieve falsy values such as boolean false', async () => {

            const key = {
                id: 'test',
                segment: 'test'
            };

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ], {
                redisOptions: {
                    partition: 'wwwtest'
                }
            });
            await redisCluster.start();
            await redisCluster.set(key, false, 200);
            const result = await redisCluster.get(key);
            expect(result.item).to.equal(false);
        });
    });

    describe('set()', () => {

        it('returns a promise that rejects when the connection is closed', async () => {

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ]);

            try {
                await redisCluster.set('test1', 'test1', 3600);
            }
            catch (err) {
                expect(err.message).to.equal('Connection not started');
            }
        });

        it('returns a promise that rejects when there is an error returned from setting an item', async () => {

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ]);
            redisCluster.client = {
                set: function (key, item, callback) {

                    return Promise.reject(Error());
                }
            };

            await expect(redisCluster.set('test', 'test', 3600)).to.reject(Error);
        });
    });

    describe('drop()', () => {

        it('returns a promise that rejects when the connection is closed', async () => {

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ]);

            try {
                await redisCluster.drop('test2');
            }
            catch (err) {
                expect(err.message).to.equal('Connection not started');
            }
        });

        it('deletes the item from redis', async () => {

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ]);
            redisCluster.client = {
                del: function (key) {

                    return Promise.resolve(null);
                }
            };

            await redisCluster.drop('test');
        });
    });

    describe('generateKey()', () => {

        it('generates the storage key from a given catbox key', () => {

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ], {
                redisOptions: {
                    partition: 'foo'
                }
            });

            const key = {
                id: 'bar',
                segment: 'baz'
            };

            expect(redisCluster.generateKey(key)).to.equal('foo:baz:bar');
        });

        it('generates the storage key from a given catbox key without partition', () => {

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ], {
                redisOptions: {}
            });

            const key = {
                id: 'bar',
                segment: 'baz'
            };

            expect(redisCluster.generateKey(key)).to.equal('baz:bar');
        });
    });

    describe('stop()', () => {

        it('sets the client to null', async () => {

            const redisCluster = new RedisCluster([
                {
                    host: '127.0.0.1',
                    port: 7000
                }
            ]);

            await redisCluster.start();
            expect(redisCluster.client).to.exist();
            await redisCluster.stop();
            expect(redisCluster.client).to.not.exist();
        });
    });
});
