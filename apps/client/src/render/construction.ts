// A building under construction grows up from the ground inside its scaffold (slice1-alive-2): the finished model is
// drawn cut at a height that follows the sim's own progress, `constructionLeft` against the build time in the content
// data, so every viewer sees the same height. A landmark site short of materials does not progress in the sim, so it
// holds. On the tick a site finishes, its scaffold goes with the landing's puff of dust (`finishPuffs` in ghost.ts).

/** The share of a site's height that shows: 0 when it is placed, rising with every tick of work, 1 when it is built. */
export function constructionRise(constructionLeft: number, buildTicks: number): number {
  if (constructionLeft <= 0 || buildTicks <= 0) return 1;
  return Math.min(1, Math.max(0, (buildTicks - constructionLeft) / buildTicks));
}
