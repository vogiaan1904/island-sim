import type { IslandState } from '@island/sim';
import { portraitPicture, ROLE_NAMES } from '../ui/names.ts';

/** The key staff member who tells the news: the island's port master, with the portrait rendered for their name. */
export interface Speaker {
  name: string;
  role: string;
  /** The rendered portrait, or null when the island has no port master (the dock's picture stands in). */
  portrait: string | null;
}

export function portMasterOf(island: IslandState): Speaker {
  const master = island.staff.find((s) => s.role === 'port-master');
  if (master === undefined) return { name: 'The port', role: ROLE_NAMES['port-master'], portrait: null };
  return { name: master.name, role: ROLE_NAMES['port-master'], portrait: portraitPicture(master.name) };
}
