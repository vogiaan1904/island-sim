import { describe, expect, it } from 'vitest';
import { content } from './index.ts';

const isWhole = (n: number) => Number.isSafeInteger(n);
const isMinute = (n: number) => isWhole(n) && n >= 0 && n < content.rules.ticksPerDay;

describe('content data', () => {
  it('uses unique ids', () => {
    for (const list of [
      content.stages,
      content.goods,
      content.needs,
      content.buildings,
      content.goals,
      content.eventTypes,
    ]) {
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
      for (const n of [b.jobs, b.storage, b.homeCapacity, b.upkeepCentsPerHour]) {
        expect(isWhole(n) && n >= 0, `${b.id} counts`).toBe(true);
      }
    }
  });

  it('has exactly one building the game places itself: the dock, which is also a store', () => {
    expect(content.buildings.filter((b) => !b.playerBuildable).map((b) => b.id)).toEqual(['dock']);
    expect(content.buildings.find((b) => b.id === 'dock')?.isStore).toBe(true);
  });

  it('gives producers jobs, a known good and room for at least one cycle of output', () => {
    const goods = new Set(content.goods.map((g) => g.id));
    for (const b of content.buildings) {
      expect(b.jobs > 0, `${b.id}: jobs exactly when it has a recipe`).toBe(b.recipe !== null);
      if (!b.recipe) continue;
      expect(goods.has(b.recipe.good), b.id).toBe(true);
      expect(b.recipe.amount >= 1 && b.recipe.cycleTicks >= 1, b.id).toBe(true);
      expect(b.storage, `${b.id} storage`).toBeGreaterThanOrEqual(b.recipe.amount);
    }
  });

  it('gives stores and food services storage, and services a known need and reach', () => {
    const needs = new Map(content.needs.map((n) => [n.id, n]));
    for (const b of content.buildings) {
      if (b.isStore) expect(b.storage, b.id).toBeGreaterThan(0);
      if (!b.serves) continue;
      const need = needs.get(b.serves.need);
      expect(need, b.id).toBeDefined();
      expect(isWhole(b.serves.reach) && b.serves.reach >= 1, b.id).toBe(true);
      if (need && need.goods.length > 0) expect(b.storage, `${b.id} shelves`).toBeGreaterThan(0);
    }
  });

  it('lets every need be met by some building, and only names known goods', () => {
    const goods = new Set(content.goods.map((g) => g.id));
    for (const need of content.needs) {
      expect(content.buildings.some((b) => b.serves?.need === need.id), need.id).toBe(true);
      for (const good of need.goods) expect(goods.has(good), need.id).toBe(true);
      expect(need.perResidentPerDay > 0, need.id).toBe(need.goods.length > 0);
    }
  });

  it('starts every stage after the first with exactly one landmark of the stage before', () => {
    const order = new Map(content.stages.map((s) => [s.id, s.order]));
    for (const stage of content.stages.slice(1)) {
      const landmarks = content.buildings.filter((b) => b.landmark?.startsStage === stage.id);
      expect(landmarks, stage.id).toHaveLength(1);
      const [hall] = landmarks;
      if (!hall?.landmark) continue;
      expect(order.get(hall.availableFrom)).toBe((order.get(stage.id) ?? 0) - 1);
      expect(hall.landmark.materials.length).toBeGreaterThan(0);
      for (const m of hall.landmark.materials) expect(isWhole(m.amount) && m.amount > 0).toBe(true);
    }
  });

  it('keeps every price whole and in order: min <= floor <= base <= max', () => {
    for (const g of content.goods) {
      const prices = [g.minPriceCents, g.floorPriceCents, g.basePriceCents, g.maxPriceCents];
      expect(prices.every((p) => isWhole(p) && p > 0), g.id).toBe(true);
      expect(prices, g.id).toEqual([...prices].sort((a, b) => a - b));
      expect(g.color, g.id).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('has goals for known stages and buildings with whole rewards', () => {
    const stages = new Set(content.stages.map((s) => s.id));
    const buildings = new Set(content.buildings.map((b) => b.id));
    for (const goal of content.goals) {
      expect(stages.has(goal.stage), goal.id).toBe(true);
      expect(isWhole(goal.rewardCents) && goal.rewardCents >= 0, goal.id).toBe(true);
      expect(isWhole(goal.target.count) && goal.target.count >= 1, goal.id).toBe(true);
      if (goal.target.kind === 'build') expect(buildings.has(goal.target.building), goal.id).toBe(true);
    }
  });

  it('has port master candidates with plain names and one of the 12 character looks', () => {
    expect(content.portMasterCandidates.length).toBeGreaterThan(0);
    for (const c of content.portMasterCandidates) {
      expect(c.name).toMatch(/^[A-Z][a-z]+$/);
      expect(isWhole(c.look) && c.look >= 0 && c.look <= 11).toBe(true);
    }
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

  it('has a clock whose ferries and passes line up', () => {
    const r = content.rules;
    for (const m of [r.startMinute, r.sunriseMinute, r.sunsetMinute, r.shiftStartMinute, r.shiftEndMinute, r.mealMinute]) {
      expect(isMinute(m)).toBe(true);
    }
    expect(r.shiftStartMinute).toBeLessThan(r.shiftEndMinute);
    expect(r.sunriseMinute).toBeLessThan(r.sunsetMinute);
    // The labor pass must run on the ferry minutes, so arriving and leaving commuters are staffed at once.
    expect(60 % r.slowPassMinutes).toBe(0);
    for (const m of [r.startMinute, r.shiftStartMinute, r.shiftEndMinute]) expect(m % r.slowPassMinutes).toBe(0);
  });

  it('keeps every other rule a whole number, and shares within 0 to 1000 permille', () => {
    const r = content.rules;
    for (const [key, value] of Object.entries(r)) {
      if (typeof value === 'number') expect(isWhole(value) && value >= 0, key).toBe(true);
    }
    for (const share of [r.childrenPermille, r.priceRevertPermille, r.priceDriftPermille, r.leaveBelowHappiness]) {
      expect(share).toBeLessThanOrEqual(1000);
    }
    expect(r.ferrySeats).toBeGreaterThan(0);
    expect(r.newcomersPerFerry).toBeLessThanOrEqual(r.ferrySeats);
    expect(r.shipmentPerPass).toBeGreaterThan(0);
    expect(r.roadTicksPerTile).toBeGreaterThan(0);
  });
});
