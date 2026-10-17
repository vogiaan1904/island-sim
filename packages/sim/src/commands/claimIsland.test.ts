import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { islandOf } from '../../test/fixtures.ts';
import { stateHash } from '../hash.ts';
import { findDockSpot } from '../placement.ts';
import { createWorld } from '../world.ts';
import { applyCommand } from './apply.ts';
import type { WorldState } from '../state.ts';

const claim = (world: WorldState, owner: string, name: string, sequence = 1) =>
  applyCommand(world, content, { type: 'claim-island', owner, name }, { sequence });

describe('claim-island', () => {
  it('claims the lowest free slot, pays the starting coins, places the dock and brings the port master', () => {
    const world = createWorld(7, content);
    const dockSpot = findDockSpot(islandOf(world, 0), content);
    const result = claim(world, 'alice', 'Palm Cove');
    expect(result).toEqual({
      ok: true,
      ledger: [{ kind: 'money', slot: 0, deltaCents: 500_000, reason: 'starting-coins' }],
      events: [{ tick: 0, source: 1, index: 0, type: 'island-claimed', slot: 0, data: { slot: 0 } }],
      data: { slot: 0 },
    });
    expect(islandOf(world, 0)).toMatchObject({
      owner: 'alice',
      name: 'Palm Cove',
      coinsCents: 500_000,
      lastCheckInTick: 0,
      buildings: [{ id: 1, type: 'dock', ...dockSpot, rotation: 0, constructionLeft: 0, conditions: [], stock: {} }],
      staff: [{ id: 2, role: 'port-master', name: 'Kofi', look: 11 }],
    });
    expect(world.nextId).toBe(3);
  });

  it('gives the next account the next slot and refuses a second island for the same account', () => {
    const world = createWorld(7, content);
    claim(world, 'alice', 'Palm Cove');
    expect(claim(world, 'bob', 'Coral Bay', 2)).toMatchObject({ ok: true, data: { slot: 1 } });
    expect(claim(world, 'alice', 'Second Home', 3)).toEqual({ ok: false, reason: 'already-has-island', shortfallCents: 0 });
  });

  it('refuses when every slot is taken', () => {
    const world = createWorld(7, content);
    for (let i = 0; i < 10; i += 1) expect(claim(world, `player-${i}`, `Isle ${i}`, i + 1).ok).toBe(true);
    expect(claim(world, 'late', 'Too Late', 11)).toMatchObject({ ok: false, reason: 'world-full' });
  });

  it('accepts names of ASCII letters, digits, single spaces, "-" and "\'" from 2 to 24 characters', () => {
    for (const name of ['Palm Cove', "O'Hara-2", 'Ab', 'x'.repeat(24)]) {
      expect(claim(createWorld(7, content), 'alice', name).ok, name).toBe(true);
    }
  });

  it('refuses other names and changes nothing', () => {
    const bad = ['A', 'x'.repeat(25), ' Palm', 'Palm ', 'Palm  Cove', '--', 'Isla \u{1F600}', 'Café', 'Palm_Cove'];
    for (const name of bad) {
      const world = createWorld(7, content);
      const before = stateHash(world);
      expect(claim(world, 'alice', name), name).toEqual({ ok: false, reason: 'bad-island-name', shortfallCents: 0 });
      expect(stateHash(world), name).toBe(before);
    }
    const world = createWorld(7, content);
    expect(claim(world, 'alice', 42 as unknown as string).ok).toBe(false);
  });

  it('refuses an empty owner as bad input', () => {
    expect(claim(createWorld(7, content), '', 'Palm Cove')).toMatchObject({ ok: false, reason: 'bad-input' });
  });
});
