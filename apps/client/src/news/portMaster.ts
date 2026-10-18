import type { IslandState } from '@island/sim';

/** The key staff member who tells the news: the island's port master, with the portrait rendered for their name. */
export interface Speaker {
  name: string;
  role: string;
  /** The rendered portrait, or null when the island has no port master (the dock's picture stands in). */
  portrait: string | null;
}

export function portMasterOf(island: IslandState): Speaker {
  const master = island.staff.find((s) => s.role === 'port-master');
  if (master === undefined) return { name: 'The port', role: 'Port master', portrait: null };
  return { name: master.name, role: 'Port master', portrait: `/icons/portrait_${master.name.toLowerCase()}_a.png` };
}
