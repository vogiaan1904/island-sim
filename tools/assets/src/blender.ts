import { spawnSync } from 'node:child_process';

// Runs the pipeline in headless Blender: pnpm blender <command> [names]. BLENDER overrides the macOS default path.
const blender = process.env.BLENDER ?? '/Applications/Blender.app/Contents/MacOS/Blender';
const script = new URL('../../blender/run.py', import.meta.url).pathname;
const result = spawnSync(
  blender,
  ['--background', '--factory-startup', '--python-exit-code', '1', '--python', script, '--', ...process.argv.slice(2)],
  { stdio: 'inherit' },
);
process.exitCode = result.status ?? 1;
