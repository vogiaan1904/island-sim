import { catalog } from '@island/assets/src/catalog.ts';
import type { Bed } from './mix.ts';

// The client plays only the sounds the asset catalog lists (tools/assets/src/catalog.ts), built by `pnpm assets sounds`.

const SOUNDS: ReadonlySet<string> = new Set(catalog.sounds);

export type UiSound = 'tap' | 'land' | 'collect';

export const BED_FILES: Readonly<Record<Bed, string>> = {
  waves: 'ambience_waves.m4a',
  birds: 'ambience_birds.m4a',
  town: 'ambience_town.m4a',
  night: 'ambience_night.m4a',
};

export const UI_FILES: Readonly<Record<UiSound, string>> = { tap: 'ui_tap.m4a', land: 'ui_land.m4a', collect: 'ui_collect.m4a' };

/** The URL of a shipped sound; throws for a file the catalog does not list. */
export function soundUrl(file: string): string {
  if (!SOUNDS.has(file)) throw new Error(`not in the asset catalog: ${file}`);
  return `/sounds/${file}`;
}
