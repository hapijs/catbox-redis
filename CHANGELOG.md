# Changelog

## [4.2.5](https://github.com/hapijs/catbox-redis/compare/v4.2.4...v4.2.5) - 2018-xx-xx

### Updated
- bump to lab 18

## [4.2.4](https://github.com/hapijs/catbox-redis/compare/v4.2.3...v4.2.4) - 2018-11-01

### Updated
- Run tests on Node.js v11 (travis)
- bump dependencies
- clean up `.gitignore`


## [4.2.3](https://github.com/hapijs/catbox-redis/compare/v4.2.2...v4.2.3) - 2018-10-09

### Updated
- fix connection issue: connection string and socket weren’t used to connect [#92](https://github.com/hapijs/catbox-redis/issues/92)


## [4.2.2](https://github.com/hapijs/catbox-redis/compare/v4.2.1...v4.2.2) - 2018-09-21

### Added
- Redis mock server for sentinel testing


### Updated
- refactor code to ES2015 class
- refactor tests
- update dependency: `ioredis v3 -> v4`
- update dependency: `lab v15 -> v16`
- update maintainer in readme


## [4.2.1](https://github.com/hapijs/catbox-redis/compare/v4.2.0...v4.2.1) - 2018-09-07

### Added
- store boolean `false` values in the cache


### Updated
- removed `package-lock.json` from repository
- extend readme on how to use a custom Redis client


## [4.2.0](https://github.com/hapijs/catbox-redis/compare/v4.1.0...v4.2.0) - 2018-08-21

### Added
- `tls` options for Redis
