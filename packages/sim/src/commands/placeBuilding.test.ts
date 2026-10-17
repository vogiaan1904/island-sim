import { describe, expect, it } from 'vitest';
import { SMALL, islandOf, smallWorld } from '../../test/fixtures.ts';
import { stateHash } from '../hash.ts';
import { serializeWorld } from '../snapshot.ts';
import type { WorldState } from '../state.ts';
import { applyCommand } from './apply.ts';
import type { Command } from './types.ts';

function place(world: WorldState, building: string, x: number, y: number, rotation = 0, slot = 0) {
  const command = { type: 'place-building', slot, building, x, y, rotation } as unknown as Command;
  return applyCommand(world, SMALL, command, { sequence: 1 });
}

describe('place-building', () => {
  it('pays the price up front and starts a construction site', () => {
    const world = smallWorld();
    expect(place(world, 'cottage', 2, 2)).toEqual({
      ok: true,
      ledger: [{ kind: 'money', slot: 0, deltaCents: -20_000, reason: 'building-purchase' }],
      events: [
        { tick: 0, source: 1, index: 0, type: 'construction-started', slot: 0, data: { buildingId: 1, building: 'cottage' } },
      ],
      data: { buildingId: 1 },
    });
    const island = islandOf(world, 0);
    expect(island.coinsCents).toBe(480_000);
    expect(island.buildings).toEqual([
      {
        id: 1,
        type: 'cottage',
        x: 2,
        y: 2,
        rotation: 0,
        constructionLeft: 120,
        priority: 1,
        stock: {},
        conditions: ['under-construction'],
        upkeepDue: false,
        work: null,
        home: { residents: 0, happiness: 1000, unmetNeeds: [] },
      },
    ]);
    expect(world.nextId).toBe(2);
  });

  it('answers the first failed placement check with its reason code', () => {
    expect(place(smallWorld(), 'cottage', -1, 0)).toMatchObject({ ok: false, reason: 'out-of-bounds' });
    expect(place(smallWorld(), 'cottage', 0, 0)).toMatchObject({ ok: false, reason: 'bad-terrain' });
    expect(place(smallWorld(), 'cottage', 3, 3)).toMatchObject({ ok: false, reason: 'tile-occupied' });
    expect(place(smallWorld(), 'cottage', 2, 5)).toMatchObject({ ok: false, reason: 'no-road-access' });
  });

  it('reports the coin shortfall and changes nothing', () => {
    const world = smallWorld(undefined, 19_999);
    const before = stateHash(world);
    expect(place(world, 'cottage', 2, 2)).toEqual({ ok: false, reason: 'not-enough-coins', shortfallCents: 1 });
    expect(stateHash(world)).toBe(before);
  });

  it('lets the player spend their last coin', () => {
    const world = smallWorld(undefined, 20_000);
    expect(place(world, 'cottage', 2, 2).ok).toBe(true);
    expect(islandOf(world, 0).coinsCents).toBe(0);
  });

  it('uses the rotated footprint', () => {
    expect(place(smallWorld(), 'farm', 5, 4, 0)).toMatchObject({ ok: false, reason: 'bad-terrain' });
    expect(place(smallWorld(), 'farm', 5, 4, 1)).toMatchObject({ ok: true });
  });

  it('answers huge coordinates with out-of-bounds instead of hanging', () => {
    expect(place(smallWorld(), 'farm', Number.MAX_SAFE_INTEGER, 2, 0)).toMatchObject({ ok: false, reason: 'out-of-bounds' });
    expect(place(smallWorld(), 'farm', 2, Number.MAX_SAFE_INTEGER, 1)).toMatchObject({ ok: false, reason: 'out-of-bounds' });
  });

  it('refuses -0 coordinates from parsed JSON, which would make the world impossible to save', () => {
    const world = smallWorld(['~~~~~~~~', ',,,,~~~~', '#,,,~~~~', ',,,,~~~~', '~~~~~~~~', '~~~~~~~~', '~~~~~~~~', '~~~~~~~~']);
    const command = JSON.parse('{"type":"place-building","slot":0,"building":"cottage","x":-0,"y":1,"rotation":0}') as Command;
    expect(applyCommand(world, SMALL, command, { sequence: 1 })).toMatchObject({ ok: false, reason: 'bad-input' });
    expect(() => serializeWorld(world)).not.toThrow();
  });

  it('refuses a spot another building already took', () => {
    const world = smallWorld();
    expect(place(world, 'cottage', 2, 2).ok).toBe(true);
    expect(place(world, 'well', 2, 2)).toMatchObject({ ok: false, reason: 'tile-occupied' });
  });

  it('refuses the dock, unknown buildings, bad coordinates and unclaimed islands', () => {
    expect(place(smallWorld(), 'dock', 1, 5)).toMatchObject({ ok: false, reason: 'not-player-buildable' });
    expect(place(smallWorld(), 'castle', 2, 2)).toMatchObject({ ok: false, reason: 'unknown-building' });
    expect(place(smallWorld(), 'cottage', 2.5, 2)).toMatchObject({ ok: false, reason: 'bad-input' });
    expect(place(smallWorld(), 'cottage', 2, 2, 4)).toMatchObject({ ok: false, reason: 'bad-input' });
    expect(place(smallWorld(), 'cottage', 2, 2, 0, 1)).toMatchObject({ ok: false, reason: 'island-not-claimed' });
  });

  it('refuses buildings from a later stage', () => {
    const later = {
      ...SMALL,
      buildings: SMALL.buildings.map((b) => (b.id === 'cottage' ? { ...b, availableFrom: 'settlement' as const } : b)),
    };
    const command = { type: 'place-building', slot: 0, building: 'cottage', x: 2, y: 2, rotation: 0 } as Command;
    expect(applyCommand(smallWorld(), later, command, { sequence: 1 })).toMatchObject({
      ok: false,
      reason: 'not-available-yet',
    });
  });
});
