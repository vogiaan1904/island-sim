import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pack } from './pack.ts';
import { list, MODELS, problems, ROOT, SOUNDS, STAGING } from './shipped.ts';
import { buildSound, SOUND_RECIPES } from './sounds.ts';

/** Compresses every staging .glb (or the named ones) into the models folder. */
async function packAll(names: string[]): Promise<number> {
  mkdirSync(MODELS, { recursive: true });
  const files = names.length > 0 ? names.map((n) => (n.endsWith('.glb') ? n : `${n}.glb`)) : list(STAGING).filter((f) => f.endsWith('.glb'));
  for (const file of files) {
    const out = await pack(readFileSync(join(STAGING, file)));
    writeFileSync(join(MODELS, file), out);
    console.log(`packed ${file} ${out.byteLength} bytes`);
  }
  return 0;
}

/** Cuts, loops and encodes every picked sound (or the named ones) into the sounds folder. Needs ffmpeg. */
function soundsAll(names: string[]): number {
  mkdirSync(SOUNDS, { recursive: true });
  for (const recipe of SOUND_RECIPES.filter((r) => names.length === 0 || names.includes(r.file))) {
    buildSound(recipe, ROOT, SOUNDS);
    console.log(`sound ${recipe.file} ${readFileSync(join(SOUNDS, recipe.file)).byteLength} bytes`);
  }
  return 0;
}

async function main(args: string[]): Promise<number> {
  if (args[0] === 'pack') return packAll(args.slice(1));
  if (args[0] === 'sounds') return soundsAll(args.slice(1));
  if (args[0] === 'check') {
    const found = await problems();
    for (const line of found) console.log(line);
    console.log(found.length === 0 ? 'assets: no problems' : `assets: ${found.length} problems`);
    return found.length === 0 ? 0 : 1;
  }
  console.log('usage: pnpm assets <pack [names]|sounds [names]|check>');
  return 1;
}

process.exitCode = await main(process.argv.slice(2));
