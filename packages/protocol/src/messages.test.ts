import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { ClientMessage } from './messages.ts';
import { PROTOCOL_VERSION } from './version.ts';

describe('ClientMessage', () => {
  it('accepts every message a client sends', () => {
    const messages = [
      { type: 'hello', protocolVersion: PROTOCOL_VERSION },
      { type: 'open-island', world: '0b8f6c1e-1d2a-4c6e-9a51-3f0d2c9b7e10', slot: 9 },
      { type: 'close-island' },
      { type: 'command', requestId: 7, command: { anything: 'is checked on its own' } },
      { type: 'mark-seen', key: { tick: 660, source: 0, index: 2 } },
    ];
    for (const message of messages) expect(v.safeParse(ClientMessage, message).success).toBe(true);
  });

  const refused: Array<[string, unknown]> = [
    ['an unknown type', { type: 'subscribe-all' }],
    ['a slot past the last island', { type: 'open-island', world: 'w1', slot: 10 }],
    ['a world id with other characters', { type: 'open-island', world: '../etc', slot: 0 }],
    ['a command without a request id', { type: 'command', command: {} }],
    ['an extra field', { type: 'close-island', everything: true }],
    ['a negative event key', { type: 'mark-seen', key: { tick: -1, source: 0, index: 0 } }],
    ['a string', 'hello'],
    ['a list', [{ type: 'hello', protocolVersion: 1 }]],
  ];
  for (const [what, input] of refused) {
    it(`refuses ${what}`, () => {
      expect(v.safeParse(ClientMessage, input).success).toBe(false);
    });
  }
});
