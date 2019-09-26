
## Options

The connection can be specified with one (and only one) of:

- `client` - a custom Redis client instance where `client` must:
  - be manually started and stopped,
  - be compatible with the **ioredis** module API, and
  - expose the `status` property that must be set to `'ready'` when connected.

- `url` - a Redis server URL.

- `socket` - a unix socket string.

- `cluster` - an array of `{ host, port }` pairs.

Or:

- `host` - a Redis server hostname. Defaults to `'127.0.0.1'` if no other connection method specified from the above.
- `port` - a Redis server port or unix domain socket path. Defaults to `6379` if no other connection method specified from the above.

**catbox** options:

- `partition` - a string used to prefix all item keys with. Defaults to `''`.

Other supported Redis options:

- `password` - the Redis authentication password when required.
- `db` - a Redis database name or number.
- `sentinels` - an array of `{ host, port }` sentinel address pairs.
- `sentinelName` - the name of the sentinel master (when `sentinels` is specified).
- `tls` - an object representing TLS config options for **ioredis**.


## Usage

Sample catbox cache initialization:

```js
const Catbox = require('@hapi/catbox');
const CatboxRedis = require('@hapi/catbox-redis');


const cache = new Catbox.Client(CatboxRedis, {
    partition : 'my_cached_data'
    host: 'redis-cluster.domain.com',
    port: 6379,
    db: 0,
    tls: {},
});
```

When used in a hapi server (hapi version 18 or newer):

```js
const Hapi = require('hapi')
const CatboxRedis = require('@hapi/catbox-redis');

const server = new Hapi.Server({
    cache : [
        {
            name: 'my_cache',
            provider: {
                constructor: CatboxRedis,
                options: {
                    partition : 'my_cached_data'
                    host: 'redis-cluster.domain.com',
                    port: 6379,
                    db: 0,
                    tls: {},
                }
            }
        }
    ]
});
```


## Tests

The test suite expects:
- a redis server to be running on port 6379
- a redis server listenning to port 6378 and requiring a password: 'secret'
- a redis server listenning on socket `/tmp/redis.sock`
- a redis cluster contains nodes running on ports 7000 to 7005

See [.travis.yml](./.travis.yml)

```sh
docker-compose up -d
redis-server &
npm test
```
