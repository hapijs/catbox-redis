catbox-redis [![Build Status](https://travis-ci.org/hapijs/catbox-redis.svg?branch=master)](https://travis-ci.org/hapijs/catbox-redis)
============

Redis adapter for catbox

Lead Maintainer: [Loic Mahieu](https://github.com/LoicMahieu)

## Options

- `url` - the Redis server URL (if `url` is provided, `host`, `port`, and `socket` are ignored)
- `host` - the Redis server hostname. Defaults to `'127.0.0.1'`.
- `port` - the Redis server port or unix domain socket path. Defaults to `6379`.
- `socket` - the unix socket string to connect to (if `socket` is provided, `host` and `port` are ignored)
- `password` - the Redis authentication password when required.
- `database` - the Redis database.
- `partition` - this will store items under keys that start with this value. (Default: '')
- `sentinels` - an array of redis sentinel addresses to connect to.
- `sentinelName` - the name of the sentinel master. (Only needed when `sentinels` is specified)

## Tests

The test suite expects:
- a redis server to be running on port 6379
- a redis server listenning to port 6378 and requiring a password: 'secret'
- a redis server listenning on socket `/tmp/redis.sock`

See [.travis.yml](./.travis.yml)

```sh
redis-server&
npm test
```
