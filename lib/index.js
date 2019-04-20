'use strict';

const CatboxRedis = require('./redis');
const CatboxRedisCluster = require('./redis-cluster');

CatboxRedis.Cluster = CatboxRedisCluster;

module.exports = CatboxRedis;
