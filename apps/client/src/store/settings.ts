import { QUALITIES, type Quality } from '../render/quality.ts';
import type { GameStore } from './store.ts';
import type { ViewState } from './view.ts';

// The choices from Settings that stay on this device (spec 6.2, ticket 18): sound, quality and controls. They live in the
// browser's localStorage under one key, as one small JSON object. Only what the player chose is saved: a quality tier the
// device guessed is never written, so a better phone or a new guess later still gets its own. Storage can be missing or
// refuse (a private window, blocked site data): then the game simply starts with the defaults and forgets on close.

export interface Settings {
  /** The tier the player chose; null while they never did (the device's guess is used). */
  quality: Quality | null;
  controls: ViewState['controlsChoice'];
  /** True when the player muted all sound. */
  muted: boolean;
}

/** The two calls of `localStorage` that settings need. */
export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'island-sim:settings';

const DEFAULTS: Settings = { quality: null, controls: 'auto', muted: false };

/** The page's localStorage, or null when the browser does not give it out. */
export function deviceStorage(): SettingsStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** What was saved, each field checked by itself: anything odd becomes its default. */
export function loadSettings(storage: SettingsStorage | null): Settings {
  let saved: unknown = null;
  try {
    const text = storage?.getItem(KEY) ?? null;
    if (text !== null) saved = JSON.parse(text);
  } catch {
    return { ...DEFAULTS };
  }
  const record = typeof saved === 'object' && saved !== null ? (saved as Record<string, unknown>) : {};
  const quality = QUALITIES.find((tier) => tier === record['quality']) ?? null;
  const controls = record['controls'] === 'trackpad' || record['controls'] === 'mouse' ? record['controls'] : 'auto';
  return { quality, controls, muted: record['muted'] === true };
}

/** Saves these fields next to the ones already saved; a refusing storage is ignored. */
export function saveSettings(storage: SettingsStorage | null, patch: Partial<Settings>): void {
  try {
    storage?.setItem(KEY, JSON.stringify({ ...loadSettings(storage), ...patch }));
  } catch {
    // Nothing to do: the choice still holds until the page closes.
  }
}

/** Puts the saved choices into the view state; run once when the game starts. */
export function applySavedSettings(store: GameStore, storage: SettingsStorage | null): void {
  const saved = loadSettings(storage);
  const patch: Partial<ViewState> = { controlsChoice: saved.controls, muted: saved.muted };
  if (saved.quality !== null) {
    patch.quality = saved.quality;
    patch.qualityChosen = true;
  }
  store.getState().setView(patch);
}
