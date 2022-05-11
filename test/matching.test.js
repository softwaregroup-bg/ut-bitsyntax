const tap = require('tap');
const match = require('../').match;
const parse = require('../').parse;
const compile = require('../').matcher;
const assert = require('assert');

const INT_TESTS = [
    ['n:8',
        [[[255], 255]]],
    ['n:8/signed',
        [[[255], -1]]],
    ['n:1/unit:8',
        [[[129], 129]]],
    ['n:1/unit:8-signed',
        [[[129], -127]]],

    ['n:16',
        [[[1, 255], 511]]],
    ['n:16/signed',
        [[[255, 65], -191]]],
    ['n:16/little',
        [[[255, 1], 511]]],
    ['n:16/signed-little',
        [[[65, 255], -191]]],

    ['n:32',
        [[[45, 23, 97, 102], 756506982]]],
    ['n:32/signed',
        [[[245, 23, 97, 102], -183017114]]],
    ['n:32/little',
        [[[245, 23, 97, 102], 1717639157]]],
    ['n:32/signed-little',
        [[[245, 23, 97, 129], -2124343307]]],

    ['n:4/signed-little-unit:8',
        [[[245, 23, 97, 129], -2124343307]]],

    ['n:64',
        [[[1, 2, 3, 4, 5, 6, 7, 8], 72623859790382850]]],
    ['n:64/signed',
        [[[255, 2, 3, 4, 5, 6, 7, 8], -71491328285473016]]],
    ['n:64/little',
        [[[1, 2, 3, 4, 5, 6, 7, 8], 578437695752307200]]],
    ['n:64/little-signed',
        [[[1, 2, 3, 4, 5, 6, 7, 255], -70080650589044220]]],
    ['n:8/signed-unit:8-little',
        [[[1, 2, 3, 4, 5, 6, 7, 255], -70080650589044220]]]
];

tap.test('Integer',
    async function(t) {
        INT_TESTS.forEach(function(p) {
            const pattern = parse(p[0]);
            const cpattern = compile(p[0]);
            p[1].forEach(function(tc) {
                t.test(p[0], async function(assert) {
                    assert.same({n: tc[1]}, match(pattern, Buffer.from(tc[0])));
                });
                t.test(p[0], async function(assert) {
                    assert.same({n: tc[1]}, cpattern(Buffer.from(tc[0])));
                });
            });
        });
    });

// test cases largely constructed in Erlang using e.g.,
// Pi = math:pi(), <<Pi:32/float>>.
const FLOAT_TESTS = [
    ['n:32/float',
        [[[64, 73, 15, 219], Math.PI], [[0, 0, 0, 0], 0.0]]],
    ['n:64/float',
        [[[64, 9, 33, 251, 84, 68, 45, 24], Math.PI], [[0, 0, 0, 0, 0, 0, 0, 0], 0.0]]],
    ['n:32/float-little',
        [[[219, 15, 73, 64], Math.PI], [[0, 0, 0, 0], 0.0]]],
    ['n:64/float-little',
        [[[24, 45, 68, 84, 251, 33, 9, 64], Math.PI],
            [[0, 0, 0, 0, 0, 0, 0, 0], 0.0]]],
    ['n:4/float-unit:8', [[[64, 73, 15, 219], Math.PI],
        [[0, 0, 0, 0], 0.0]]]
];

tap.test('Float',
    async function(t) {
        const precision = 0.00001;
        FLOAT_TESTS.forEach(function(p) {
            const pattern = parse(p[0]);
            const cpattern = compile(p[0]);
            p[1].forEach(function(tc) {
                t.test(p[0], async function(asset) {
                    const m = match(pattern, Buffer.from(tc[0]));
                    assert.ok(m.n !== undefined);
                    assert.ok(Math.abs(tc[1] - m.n) < precision);
                });
                t.test(p[0], async function(asset) {
                    const m = cpattern(Buffer.from(tc[0]));
                    assert.ok(m.n !== undefined);
                    assert.ok(Math.abs(tc[1] - m.n) < precision);
                });
            });
        });
    });

const BINARY_TESTS = [
    ['n:0/unit:8-binary', []],
    ['n:1/unit:8-binary', [93]],
    ['n:5/unit:8-binary', [1, 2, 3, 4, 5]],
    ['n:32/unit:1-binary', [255, 254, 253, 252]]
];

tap.test('Binary',
    async function(t) {
        BINARY_TESTS.forEach(function(p) {
            const pattern = parse(p[0]);
            const cpattern = compile(p[0]);
            const prest = p[0] + ', _/binary';
            const patternrest = parse(prest);
            const cpatternrest = compile(prest);
            t.test(p[0], async function(assert) {
                assert.same({n: Buffer.from(p[1])},
                    match(pattern, Buffer.from(p[1])));
                assert.same({n: Buffer.from(p[1])},
                    cpattern(Buffer.from(p[1])));
            });
            t.test(prest, async function(assert) {
                const plusgarbage = p[1].concat([5, 98, 23, 244]);
                assert.same({n: Buffer.from(p[1])},
                    match(patternrest, Buffer.from(plusgarbage)));
                assert.same({n: Buffer.from(p[1])},
                    cpatternrest(Buffer.from(plusgarbage)));
            });
        });
    });

const VAR_TESTS = [
    ['size, n:size',
        [[[8, 5], 5],
            [[32, 0, 0, 0, 167], 167]]],

    ['size, n:size/binary',
        [[[2, 5, 6], Buffer.from([5, 6])]]],

    ['a, b:a, n:b',
        [[[8, 32, 0, 0, 2, 100], 612]]]
];

tap.test('Environment',
    async function(t) {
        VAR_TESTS.forEach(function(p) {
            const pattern = parse(p[0]);
            const cpattern = compile(p[0]);
            p[1].forEach(function(tc) {
                t.test(p[0], async function(assert) {
                    assert.same(tc[1], match(pattern, Buffer.from(tc[0])).n);
                });
                t.test(p[0], async function(assert) {
                    assert.same(tc[1], cpattern(Buffer.from(tc[0])).n);
                });
            });
        });
    });

const STRING_TESTS = [
    ['"foobar", n:8', 'foobarA', 'A'.charCodeAt(0)],
    ['n:8, "foobar", _/binary', 'CfoobarGARBAGE', 'C'.charCodeAt(0)],
    ['"foo, :-bar\\"", n:8, "another"', 'foo, :-bar"Zanother', 'Z'.charCodeAt(0)]
];

tap.test('String', async function(t) {
    STRING_TESTS.forEach(function(p) {
        const pattern = parse(p[0]);
        const cpattern = compile(p[0]);
        t.test(p[0], async function(assert) {
            const res = match(pattern, Buffer.from(p[1]));
            assert.same(res.n, p[2]);
        });
        t.test(p[0], async function(assert) {
            const res = cpattern(Buffer.from(p[1]));
            assert.same(res.n, p[2]);
        });
    });
});
