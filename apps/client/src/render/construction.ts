// A building under construction is drawn inside its scaffold and rises in steps (spec 12.5). The step comes from the
// sim's own progress, `constructionLeft` against the build time in the content data, so every viewer sees the same
// step. A landmark site short of materials does not progress in the sim, so it stays at step 0.

/** Steps a site climbs before it is built: it is at step 0 when placed and at this number once finished. */
export const CONSTRUCTION_STEPS = 4;

/** The construction step of a site: 0 up to CONSTRUCTION_STEPS - 1 while ticks are left, CONSTRUCTION_STEPS when built. */
export function constructionStep(constructionLeft: number, buildTicks: number): number {
  if (constructionLeft <= 0 || buildTicks <= 0) return CONSTRUCTION_STEPS;
  const done = Math.max(0, buildTicks - constructionLeft) / buildTicks;
  return Math.min(CONSTRUCTION_STEPS - 1, Math.floor(done * CONSTRUCTION_STEPS));
}

/** How much of the finished building's height shows at a step: 0 at step 0, 1 when built. */
export function constructionRise(step: number): number {
  return Math.min(1, Math.max(0, step / CONSTRUCTION_STEPS));
}
