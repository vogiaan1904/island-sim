import { content } from '@island/content';
import { SIM_VERSION, contentHash } from '@island/sim';
import { BOT_VERSION } from './bot.ts';
import { MILESTONES, runPacing, type PacingRun } from './pacing.ts';
import { PATTERNS } from './patterns.ts';

// pnpm pacing [--seeds 42,1,2] [--fast]
// Prints one report per seed and pattern, and exits with 1 when any milestone is late or never reached. Early is
// reported but does not fail: it calls for slower numbers, not a broken build.

const args = process.argv.slice(2);
const seedsArg = args[args.indexOf('--seeds') + 1];
const seeds = args.includes('--seeds') && seedsArg ? seedsArg.split(',').map(Number) : [42, 1, 2, 3, 4];
const invariants = !args.includes('--fast');

const TICK_SECONDS = 2.5;

function realTime(ticks: number): string {
  const minutes = Math.round((ticks * TICK_SECONDS) / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function report(run: PacingRun): boolean {
  console.log(
    `Pacing report  seed ${run.seed}  bot ${BOT_VERSION}  pattern ${run.pattern}  invariants ${run.invariants ? 'on' : 'off'}` +
      `  sim ${SIM_VERSION}  content ${contentHash(content)}`,
  );
  console.log('milestone          tick      game days   real time     since previous   target                  verdict');
  let ok = true;
  let previous = 0;
  MILESTONES.forEach((milestone, i) => {
    const tick = run.reachedAt[i] ?? null;
    if (tick === null) {
      ok = false;
      console.log(`${milestone.name.padEnd(18)} never reached                                         ${milestone.target.padEnd(23)} late`);
      return;
    }
    const verdict = tick > milestone.targetTicks ? 'late' : tick < milestone.earlyTicks ? 'early' : 'on target';
    if (verdict === 'late') ok = false;
    console.log(
      [
        milestone.name.padEnd(18),
        String(tick).padEnd(9),
        (tick / 1_440).toFixed(1).padEnd(11),
        realTime(tick).padEnd(13),
        realTime(tick - previous).padEnd(16),
        milestone.target.padEnd(23),
        verdict,
      ].join(' '),
    );
    previous = tick;
  });
  const refused = Object.entries(run.refused).map(([reason, n]) => `${reason} x${n}`);
  console.log(`commands accepted ${run.log.length}${refused.length > 0 ? `, refused ${refused.join(', ')}` : ''}\n`);
  return ok;
}

let allOk = true;
for (const pattern of PATTERNS) {
  for (const seed of seeds) {
    if (!report(runPacing(seed, pattern, content, { invariants }))) allOk = false;
  }
}
process.exit(allOk ? 0 : 1);
