import type { BuildingId } from '@island/content';

// One plain sentence per building for the placement panel (island-ui, text-tone.md): what it does for the island, no
// numbers that content already holds. The size line is made from the footprint where it is shown.

export const BUILDING_BLURBS: Record<BuildingId, string> = {
  dock: 'Where the ferry lands. The game places it.',
  'lumber-camp': 'Cuts wood for building and selling. Needs workers.',
  farm: 'Grows vegetables for your residents. Needs workers.',
  'fishing-hut': 'Brings in fish from the shore. Needs workers.',
  warehouse: 'Keeps goods safe until you need them.',
  cottage: 'A home for a few residents.',
  well: 'Gives the homes around it fresh water.',
  market: 'Sells food to the homes around it.',
  'island-hall': 'The heart of the island. Finishing it starts the Settlement.',
};
