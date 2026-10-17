import { describe, expect, it } from 'vitest';
import { canonicalJson, cyrb53, stateHash } from './hash.ts';

describe('canonicalJson', () => {
  it('sorts object keys at every depth and keeps array order', () => {
    expect(canonicalJson({ b: 1, a: [2, { d: true, c: null }] })).toBe('{"a":[2,{"c":null,"d":true}],"b":1}');
  });

  it('rejects data the sim must not keep in state', () => {
    expect(() => canonicalJson({ a: 1.5 })).toThrow(/\$\.a is not a safe integer/);
    expect(() => canonicalJson({ a: Number.NaN })).toThrow(/not a safe integer/);
    expect(() => canonicalJson({ a: -0 })).toThrow(/not a safe integer/);
    expect(() => canonicalJson({ a: undefined })).toThrow(/unsupported type undefined/);
    expect(() => canonicalJson({ a: new Map() })).toThrow(/not a plain object/);
    expect(() => canonicalJson(new Array(2))).toThrow(/is a hole/);
  });
});

describe('cyrb53', () => {
  it('matches known values', () => {
    expect(cyrb53('')).toBe(3338908027751811);
    expect(cyrb53('island')).toBe(1756179538580682);
  });
});

describe('stateHash', () => {
  it('does not depend on the order keys were added', () => {
    expect(stateHash({ x: 1, y: 2 })).toBe(stateHash({ y: 2, x: 1 }));
  });

  it('is 14 hex digits', () => {
    expect(stateHash({ b: 1, a: [2, { d: true, c: null }] })).toBe('17b7a6c5fb218b');
  });
});
