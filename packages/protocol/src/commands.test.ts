import { content } from '@island/content';
import { applyCommand, createWorld, type Command } from '@island/sim';
import * as v from 'valibot';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { PlayerCommand, toSimCommand } from './commands.ts';

type SimPlayerCommand = Exclude<Command, { type: 'claim-island' | 'check-in' }>;

const valid: PlayerCommand[] = [
  { type: 'place-building', building: 'cottage', x: 3, y: 4, rotation: 1 },
  { type: 'place-road', tiles: [[1, 2], [1, 3]] },
  { type: 'remove-road', tiles: [[1, 2]] },
  { type: 'hire-commuters', count: 4 },
  { type: 'set-priority', buildingId: 7, priority: 2 },
  { type: 'set-auto-sell', good: 'wood', keep: null },
  { type: 'sell', good: 'fish', amount: 10 },
  { type: 'buy-materials', buildingId: 9 },
  { type: 'collect', goal: 'first-farm' },
];

describe('PlayerCommand', () => {
  it('has a schema for every command a player sends, and none for those the server applies itself', () => {
    expectTypeOf<PlayerCommand['type']>().toEqualTypeOf<SimPlayerCommand['type']>();
    expect(new Set(valid.map((command) => command.type)).size).toBe(9);
  });

  it('accepts each command as the sim defines it, without the slot', () => {
    for (const command of valid) expect(v.parse(PlayerCommand, command)).toEqual(command);
  });

  const refused: Array<[string, unknown]> = [
    ['an unknown type', { type: 'demolish', buildingId: 1 }],
    ['a command the server applies itself', { type: 'claim-island', owner: 'mallory', name: 'Evil Isle' }],
    ['a slot, which comes from the session', { type: 'hire-commuters', count: 1, slot: 3 }],
    ['an extra field', { type: 'collect', goal: 'first-farm', reward: 1_000_000 }],
    ['a fractional coordinate', { type: 'place-building', building: 'well', x: 1.5, y: 2, rotation: 0 }],
    ['a coordinate off the island', { type: 'place-building', building: 'well', x: 64, y: 2, rotation: 0 }],
    ['a number sent as text', { type: 'sell', good: 'fish', amount: '10' }],
    ['an unknown building', { type: 'place-building', building: 'castle', x: 1, y: 2, rotation: 0 }],
    ['rotation 4', { type: 'place-building', building: 'well', x: 1, y: 2, rotation: 4 }],
    ['an empty road', { type: 'place-road', tiles: [] }],
    ['a road longer than the island has tiles', { type: 'place-road', tiles: Array.from({ length: 64 * 64 + 1 }, () => [0, 0]) }],
    ['a tile with three numbers', { type: 'place-road', tiles: [[1, 2, 3]] }],
    ['a negative amount', { type: 'sell', good: 'fish', amount: -1 }],
    ['a priority above high', { type: 'set-priority', buildingId: 1, priority: 3 }],
    ['an unknown goal', { type: 'collect', goal: 'world-peace' }],
    ['null', null],
  ];
  for (const [what, input] of refused) {
    it(`refuses ${what}`, () => {
      expect(v.safeParse(PlayerCommand, input).success).toBe(false);
    });
  }

  it("becomes a sim command for the sender's own island that the sim accepts", () => {
    const world = createWorld(42, content);
    applyCommand(world, content, { type: 'claim-island', owner: 'alice', name: 'Palm Cove' }, { sequence: 1 });
    const parsed = v.parse(PlayerCommand, JSON.parse('{"type":"place-road","tiles":[[14,26],[14,25]]}'));
    const command = toSimCommand(parsed, 0);
    expect(command).toEqual({ type: 'place-road', slot: 0, tiles: [[14, 26], [14, 25]] });
    expect(applyCommand(world, content, command, { sequence: 2 }).ok).toBe(true);
  });
});
