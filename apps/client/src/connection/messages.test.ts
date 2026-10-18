import { describe, expect, it } from 'vitest';
import { parseServerMessage } from './messages.ts';

describe('reading a server frame', () => {
  it('types a JSON frame of a known message type as the protocol message', () => {
    expect(parseServerMessage('{"type":"status","world":"w1","status":"paused"}')).toEqual({ type: 'status', world: 'w1', status: 'paused' });
  });

  it('drops frames that are not JSON objects of a known type', () => {
    for (const frame of ['not json', '[]', 'null', '42', '{"kind":"island"}', '{"type":"teleport"}', '{"type":7}']) {
      expect(parseServerMessage(frame)).toBeNull();
    }
    expect(parseServerMessage(new ArrayBuffer(4))).toBeNull();
  });
});
