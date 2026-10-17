import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands/apply.ts';
import { stateHash } from './hash.ts';
import { SnapshotError, loadWorld, serializeWorld, type SnapshotErrorCode } from './snapshot.ts';
import { createWorld } from './world.ts';

function codeOf(load: () => unknown): SnapshotErrorCode | 'no-error' {
  try {
    load();
    return 'no-error';
  } catch (error) {
    if (error instanceof SnapshotError) return error.code;
    throw error;
  }
}

function claimedWorld() {
  const world = createWorld(5, content);
  applyCommand(world, content, { type: 'claim-island', owner: 'alice', name: 'Palm Cove' }, { sequence: 1 });
  return world;
}

describe('snapshots', () => {
  it('round-trip a world exactly', () => {
    const world = claimedWorld();
    const loaded = loadWorld(serializeWorld(world), content);
    expect(loaded).toEqual(world);
    expect(stateHash(loaded)).toBe(stateHash(world));
  });

  it('refuse a snapshot from a newer sim version', () => {
    const json = serializeWorld({ ...claimedWorld(), simVersion: 2 });
    expect(codeOf(() => loadWorld(json, content))).toBe('newer-sim-version');
  });

  it('refuse things that are not snapshots', () => {
    expect(codeOf(() => loadWorld('not json', content))).toBe('not-a-snapshot');
    expect(codeOf(() => loadWorld('[]', content))).toBe('not-a-snapshot');
    expect(codeOf(() => loadWorld('{}', content))).toBe('not-a-snapshot');
  });

  it('refuse fractions and other data the sim never stores', () => {
    const json = serializeWorld(claimedWorld()).replace('"coinsCents":500000', '"coinsCents":1.5');
    expect(codeOf(() => loadWorld(json, content))).toBe('invalid-data');
  });

  it('refuse snapshots whose shape is broken', () => {
    expect(codeOf(() => loadWorld('{"simVersion":1}', content))).toBe('invalid-data');
    const json = serializeWorld(claimedWorld());
    expect(codeOf(() => loadWorld(json.replace('"type":"dock"', '"type":"castle"'), content))).toBe('invalid-data');
    expect(codeOf(() => loadWorld(json.replace('"roads":"0', '"roads":"'), content))).toBe('invalid-data');
  });

  it('report a migration that throws as migration-failed', () => {
    const json = serializeWorld(claimedWorld());
    const failing = () => {
      throw new Error('boom');
    };
    expect(codeOf(() => loadWorld(json, content, { 1: failing }, 2))).toBe('migration-failed');
  });

  it('migrate older snapshots one version at a time', () => {
    const json = serializeWorld(claimedWorld());
    const migrated = loadWorld(json, content, { 1: (data) => ({ ...data, harbor: 7 }) }, 2) as unknown as Record<string, unknown>;
    expect(migrated.simVersion).toBe(2);
    expect(migrated.harbor).toBe(7);
  });

  it('stop when a migration is missing', () => {
    const json = serializeWorld(claimedWorld());
    expect(codeOf(() => loadWorld(json, content, {}, 2))).toBe('missing-migration');
  });
});
