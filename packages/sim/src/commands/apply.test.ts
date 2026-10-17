import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { createWorld } from '../world.ts';
import { applyCommand } from './apply.ts';
import type { Command } from './types.ts';

describe('applyCommand', () => {
  it('answers malformed commands with bad-input instead of throwing', () => {
    const world = createWorld(7, content);
    for (const command of [null, 'claim', {}, { type: 'fly' }]) {
      expect(applyCommand(world, content, command as unknown as Command, { sequence: 1 })).toEqual({
        ok: false,
        reason: 'bad-input',
        shortfallCents: 0,
      });
    }
  });

  it('treats a sequence number below 1 as a bug', () => {
    const world = createWorld(7, content);
    const command: Command = { type: 'check-in', slot: 0 };
    expect(() => applyCommand(world, content, command, { sequence: 0 })).toThrow(/sequence/);
  });
});
