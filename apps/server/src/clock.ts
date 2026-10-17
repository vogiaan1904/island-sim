/** The server's only source of real time; the sim never sees it (island-server, core rule 3). Tests pass their own. */
export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };
