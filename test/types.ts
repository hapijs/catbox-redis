import { Engine } from '..';
import Redis, { Cluster } from 'ioredis';

async function test() {
    const cache = new Engine<string>({
        client: new Redis(),
        host: 'localhost',
        partition: 'test',
        port: 2018,
    });

    await cache.start()

    cache.get({
        segment: 'test',
        id: 'test',
    });

    cache.set({
        segment: 'test',
        id: 'test',
    }, 'test', 123);


    new Engine({
        client: new Cluster([
            {
                host: '127.0.0.1',
                port: 27379
            },
            {
                host: '127.0.0.2',
                port: 27379
            }
        ])
    });
}

test();
