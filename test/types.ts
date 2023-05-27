import { Engine } from '..';
import Redis, { Cluster } from 'ioredis';

const cache = new Engine<string>({
    client: new Redis(),
    host: 'localhost',
    partition: 'test',
    port: 2018,
});

cache.get({
    segment: 'test',
    id: 'test',
});

cache.set({
    segment: 'test',
    id: 'test',
}, 'test', 123);


new Engine({
    client: new Cluster([new Redis(), new Redis()])
});
