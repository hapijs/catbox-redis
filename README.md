<a href="http://hapijs.com"><img src="https://github.com/hapijs/assets/blob/master/images/family.svg" width="180px" align="right" /></a>

# catbox-redis

Redis adapter for [catbox](https://github.com/hapijs/catbox)

[![Build Status](https://travis-ci.org/hapijs/catbox-redis.svg?branch=master)](https://travis-ci.org/hapijs/catbox-redis)


## Options

- `url` - the Redis server URL (if `url` is provided, `host`, `port`, and `socket` are ignored)
- `host` - the Redis server hostname. Defaults to `'127.0.0.1'`
- `port` - the Redis server port or unix domain socket path. Defaults to `6379`
- `socket` - the unix socket string to connect to (if `socket` is provided, `host` and `port` are ignored)
- `password` - the Redis authentication password when required
- `database` - the Redis database
- `partition` - this will store items under keys that start with this value. (Default: '')
- `sentinels` - an array of redis sentinel addresses to connect to
- `sentinelName` - the name of the sentinel master. (Only needed when `sentinels` is specified)


### Use a Custom Redis Client
`catbox-redis` allows you to specify a custom Redis client. Using a custom `client` puts you in charge of lifecycle handling (client start/stop).

**Requirements**

- `client` must be compatible with the `ioredis` API
- `client` must also expose the `status` property that needs to match `ready` when connected
- `client` is ready when `client.status === 'ready'` resolves to `true`

All other options of `catbox-redis` are ignored when providing a custom `client`.

- `client` - a custom Redis client instance




## Usage
Sample catbox cache initialization :

```JS
const Catbox = require('catbox');

const cache = new Catbox.Client(require('catbox-redis'), {
    // your catbox-redis options
})
```

Or configure your hapi server to use `catbox-redis` as the caching strategy (code snippet uses hapi `v17`):

```js
const Hapi = require('hapi')

const server = new Hapi.Server({
    cache : [{
        name: 'redis-cache',
        engine: require('catbox-redis'),
        partition: 'cache-posts'
    }]
});
```

For hapi `v18` you need a slightly different config:

```js
const Hapi = require('hapi')
 
const server = new Hapi.Server({
    cache : [{
        name: 'redis-cache',
        provider: {
          constructor: require('catbox-redis'),
          options: {
            partition : 'cache-posts'
          }
        }
    }]
});
```


## Tests

The test suite expects:
- a redis server to be running on port 6379
- a redis server listenning to port 6378 and requiring a password: 'secret'
- a redis server listenning on socket `/tmp/redis.sock`

See [.travis.yml](./.travis.yml)

```sh
redis-server &
npm test
```
