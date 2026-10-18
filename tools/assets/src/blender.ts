import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Runs the pipeline in headless Blender: pnpm blender <command> [names]. BLENDER overrides the macOS default path.
const blender = process.env.BLENDER ?? '/Applications/Blender.app/Contents/MacOS/Blender';
const script = fileURLToPath(new URL('../../blender/run.py', import.meta.url));
const result = spawnSync(
  blender,
  ['--background', '--factory-startup', '--python-exit-code', '1', '--python', script, '--', ...process.argv.slice(2)],
  { stdio: 'inherit' },
);
if (result.error) {
  console.error(`could not start Blender at ${blender} (set BLENDER to its path): ${result.error.message}`);
}
process.exitCode = result.status ?? 1;
