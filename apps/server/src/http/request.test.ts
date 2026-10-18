import { Readable } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import { readJson } from './request.ts';

describe('readJson', () => {
  it('reads a JSON body', async () => {
    const body = Readable.from([Buffer.from('{"a":'), Buffer.from('1}')]) as unknown as IncomingMessage;
    expect(await readJson(body)).toEqual({ ok: true, value: { a: 1 } });
  });

  it('answers bad-request, not a throw, when the client goes away mid-body', async () => {
    const body = new Readable({
      read() {
        this.push(Buffer.from('{"a":'));
        this.destroy(new Error('aborted'));
      },
    }) as unknown as IncomingMessage;
    expect(await readJson(body)).toEqual({ ok: false, reason: 'bad-request' });
  });
});
