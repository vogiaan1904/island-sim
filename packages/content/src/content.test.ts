import { describe, expect, it } from 'vitest';
import { content } from './index.ts';

const isWhole = (n: number) => Number.isSafeInteger(n);

describe('content data', () => {
  it('uses unique ids', () => {
    for (const list of [content.stages, content.buildings, content.eventTypes]) {
      const ids = list.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('has stages in a strict order', () => {
    const orders = content.stages.map((stage) => stage.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('gives every building whole, sensible numbers and a known stage', () => {
    const stageIds = new Set(content.stages.map((stage) => stage.id));
    for (const b of content.buildings) {
      expect(isWhole(b.footprint.w) && b.footprint.w >= 1, `${b.id} footprint w`).toBe(true);
      expect(isWhole(b.footprint.h) && b.footprint.h >= 1, `${b.id} footprint h`).toBe(true);
      expect(isWhole(b.priceCents) && b.priceCents >= 0, `${b.id} price`).toBe(true);
      expect(isWhole(b.buildTicks) && b.buildTicks >= 0, `${b.id} build ticks`).toBe(true);
      expect(stageIds.has(b.availableFrom), `${b.id} stage`).toBe(true);
      if (b.playerBuildable) expect(b.buildTicks, `${b.id} must take time to build`).toBeGreaterThan(0);
    }
  });

  it('has exactly one building the game places itself: the dock', () => {
    expect(content.buildings.filter((b) => !b.playerBuildable).map((b) => b.id)).toEqual(['dock']);
  });

  it('gives event types an importance from 0 to 100', () => {
    for (const e of content.eventTypes) {
      expect(isWhole(e.importance) && e.importance >= 0 && e.importance <= 100, e.id).toBe(true);
    }
  });

  it('has world rules that match the spec', () => {
    const r = content.rules;
    expect(r.slotCount).toBe(10);
    expect(r.ticksPerDay).toBe(1440);
    expect(r.activeIslandTicks).toBe(7 * 24 * 1440);
    expect(r.islandName).toEqual({ minLength: 2, maxLength: 24 });
    expect(r.islandSize).toBeGreaterThanOrEqual(16);
  });
});
