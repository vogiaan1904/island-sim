import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { content } from '@island/content';
import { catalog } from './catalog.ts';
import { checkAnimation, checkIcon, checkModel } from './check.ts';
import { loadRules } from './rules.ts';
import { checkSound, soundBudgetProblems } from './sounds.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
export const STAGING = join(root, 'assets/build/staging');
export const MODELS = join(root, 'apps/client/public/models');
export const ICONS = join(root, 'apps/client/public/icons');
export const SOUNDS = join(root, 'apps/client/public/sounds');
export const ROOT = root;
/** The Mini Characters in pack order; the index is the "look" of key staff in content data. */
export const CHARACTERS = ['female-a', 'female-b', 'female-c', 'female-d', 'female-e', 'female-f', 'male-a', 'male-b', 'male-c', 'male-d', 'male-e', 'male-f'];

export const list = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir).filter((f) => !f.startsWith('.')).sort() : []);

/** Every problem with what the game ships, one line each. */
export async function problems(): Promise<string[]> {
  const rules = loadRules();
  const out: string[] = [];
  const models = list(MODELS);
  const icons = list(ICONS);
  for (const file of models.filter((f) => !catalog.models.includes(f))) out.push(`${file}: not in the catalog (tools/assets/src/catalog.ts)`);
  for (const file of catalog.models.filter((f) => !models.includes(f))) out.push(`${file}: in the catalog but not shipped`);
  for (const file of icons.filter((f) => !catalog.icons.includes(f))) out.push(`icons/${file}: not in the catalog`);
  for (const file of catalog.icons.filter((f) => !icons.includes(f))) out.push(`icons/${file}: in the catalog but not shipped`);
  for (const file of models.filter((f) => f.endsWith('.glb'))) {
    for (const p of await checkModel(file, readFileSync(join(MODELS, file)), rules, content)) out.push(`${file}: ${p}`);
  }
  for (const file of icons) for (const p of checkIcon(file, readFileSync(join(ICONS, file)), rules)) out.push(`icons/${file}: ${p}`);
  const sounds = list(SOUNDS);
  for (const file of sounds.filter((f) => !catalog.sounds.includes(f))) out.push(`sounds/${file}: not in the catalog`);
  for (const file of catalog.sounds.filter((f) => !sounds.includes(f))) out.push(`sounds/${file}: in the catalog but not shipped`);
  const sizes: number[] = [];
  for (const file of sounds) {
    const bytes = readFileSync(join(SOUNDS, file));
    sizes.push(bytes.byteLength);
    for (const p of checkSound(file, bytes)) out.push(`sounds/${file}: ${p}`);
  }
  out.push(...soundBudgetProblems(sizes));
  if (models.includes('characters-animation.json')) {
    const manifest = JSON.parse(readFileSync(join(MODELS, 'characters-animation.json'), 'utf8'));
    const bin = readFileSync(join(MODELS, 'characters-animation.bin'));
    for (const p of checkAnimation(manifest, bin, rules, CHARACTERS)) out.push(`characters-animation: ${p}`);
  }
  return out;
}
