import { describe, expect, it } from 'vitest';
import { createGameStore } from './store.ts';
import { applySavedSettings, loadSettings, saveSettings, type SettingsStorage } from './settings.ts';

function memory(initial: Record<string, string> = {}): SettingsStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const DEFAULTS = { quality: null, controls: 'auto', muted: false };

describe('the settings kept on the device', () => {
  it('start as the defaults when nothing was saved', () => {
    expect(loadSettings(memory())).toEqual(DEFAULTS);
  });

  it('come back as saved', () => {
    const storage = memory();
    saveSettings(storage, { quality: 'low' });
    saveSettings(storage, { muted: true });
    saveSettings(storage, { controls: 'trackpad' });
    expect(loadSettings(storage)).toEqual({ quality: 'low', controls: 'trackpad', muted: true });
  });

  it('ignore anything broken or odd and fall back to the defaults, field by field', () => {
    expect(loadSettings(memory({ 'island-sim:settings': 'not json' }))).toEqual(DEFAULTS);
    expect(loadSettings(memory({ 'island-sim:settings': JSON.stringify({ quality: 'ultra', controls: 'mouse', muted: 'yes' }) }))).toEqual({
      quality: null,
      controls: 'mouse',
      muted: false,
    });
  });

  it('survive a device that refuses storage', () => {
    const refusing: SettingsStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadSettings(refusing)).toEqual(DEFAULTS);
    expect(() => saveSettings(refusing, { muted: true })).not.toThrow();
    expect(loadSettings(null)).toEqual(DEFAULTS);
  });

  it("are put into the view state at start, a saved tier counting as the player's own", () => {
    const store = createGameStore();
    applySavedSettings(store, memory({ 'island-sim:settings': JSON.stringify({ quality: 'high', controls: 'mouse', muted: true }) }));
    expect(store.getState().view).toMatchObject({ quality: 'high', qualityChosen: true, controlsChoice: 'mouse', muted: true });
  });

  it('leave the view state alone when nothing was saved', () => {
    const store = createGameStore();
    applySavedSettings(store, memory());
    expect(store.getState().view).toMatchObject({ quality: null, qualityChosen: false, controlsChoice: 'auto', muted: false });
  });
});
