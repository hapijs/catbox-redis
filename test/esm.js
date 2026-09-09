'use strict';

const Code = require('@hapi/code');
const Lab = require('@hapi/lab');


const { before, describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('import()', () => {

    let CatboxRedis;

    before(async () => {

        CatboxRedis = await import('../lib/index.js');
    });

    it('exposes all methods and classes as named imports', () => {

        // node >= 23 adds a 'module.exports' named export on cjs modules, drop it to keep the assertion strict

        const keys = Object.keys(CatboxRedis).filter((key) => key !== 'module.exports');

        expect(keys).to.equal([
            'Engine',
            'default'
        ]);
    });
});
