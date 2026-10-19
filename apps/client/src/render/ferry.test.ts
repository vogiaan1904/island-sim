import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { aliceWorld, islandOf } from '../test/islands.ts';
import { ferryPose, ferryRoute, ferrySchedule, newFerryPose, type FerryPose } from './ferry.ts';
import { TILE_SIZE } from './look.ts';

const at = (minute: number) => minute - content.rules.startMinute + content.rules.ticksPerDay;
const MORNING = content.rules.shiftStartMinute;
const EVENING = content.rules.shiftEndMinute;

function poseAt(ticks: number, stay: { tick: number; minutes: number } | null = null): FerryPose {
  const route = ferryRoute(islandOf(aliceWorld()), content);
  if (route === null) throw new Error('no route');
  const out = newFerryPose();
  ferryPose(ferrySchedule(route, content, stay), ticks, out);
  return { ...out };
}

describe('the ferry route', () => {
  it('ends at a berth just off the pier, on a straight lane from the Mainland in the south', () => {
    const route = ferryRoute(islandOf(aliceWorld()), content);
    if (route === null) throw new Error('no route');
    // Alice's dock is at (31,56); its pier is the water tile in front of it, so the berth is south of that.
    expect(route.berth.z).toBeGreaterThan(58 * TILE_SIZE);
    expect(route.from.x).toBeCloseTo(route.berth.x);
    expect(route.from.z).toBeGreaterThan(content.rules.islandSize * TILE_SIZE + 100);
    expect(Math.hypot(route.bow.x - route.berth.x, route.bow.z - route.berth.z)).toBeLessThan(3);
  });

  it('is null for an island without a dock', () => {
    expect(ferryRoute(islandOf(aliceWorld(), 1), content)).toBeNull();
  });
});

describe('the ferry over a trip', () => {
  const route = ferryRoute(islandOf(aliceWorld()), content);
  if (route === null) throw new Error('no route');

  it('is away between trips, and comes in from the south over the 20 minutes before docking', () => {
    expect(poseAt(at(360)).visible).toBe(false);
    expect(poseAt(at(MORNING - 21)).visible).toBe(false);
    const coming = poseAt(at(MORNING - 10));
    expect(coming.visible).toBe(true);
    expect(coming.z).toBeGreaterThan(route.berth.z);
    expect(coming.z).toBeLessThan(route.from.z);
    expect(poseAt(at(MORNING - 5)).z).toBeLessThan(coming.z);
  });

  it('docks at the berth on the sim\'s minute and stays at least 25 minutes', () => {
    for (const minute of [MORNING, MORNING + 10, MORNING + 24, EVENING, EVENING + 20]) {
      const docked = poseAt(at(minute));
      expect(docked).toMatchObject({ visible: true });
      expect(docked.x).toBeCloseTo(route.berth.x);
      expect(docked.z).toBeCloseTo(route.berth.z);
    }
  });

  it('then sails back south and is gone 20 minutes later', () => {
    const leaving = poseAt(at(MORNING + 35));
    expect(leaving.visible).toBe(true);
    expect(leaving.z).toBeGreaterThan(route.berth.z + 1);
    expect(poseAt(at(MORNING + 46)).visible).toBe(false);
  });

  it('waits for the last boarding passenger of its manifest trip', () => {
    const stay = { tick: at(EVENING), minutes: 40 };
    expect(poseAt(at(EVENING + 35), stay).z).toBeCloseTo(route.berth.z);
    expect(poseAt(at(EVENING + 45), stay).z).toBeGreaterThan(route.berth.z + 1);
    // The next day's trip is a new trip: it does not wait.
    expect(poseAt(at(EVENING + 35) + content.rules.ticksPerDay, stay).z).toBeGreaterThan(route.berth.z + 1);
  });

  it('bobs with the water and is the same for the same time', () => {
    expect(poseAt(at(MORNING + 5))).toEqual(poseAt(at(MORNING + 5)));
    expect(poseAt(at(MORNING + 5)).y).not.toBe(poseAt(at(MORNING + 5.3)).y);
  });
});
