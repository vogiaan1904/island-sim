import type { Caption } from '../../camera/watch.ts';
import { STAGE_NAMES, theBuilding } from '../names.ts';

// One plain line per watch-mode moment (island-ui: calm, short, never emoji or emoji-like symbols).

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const EVENT_WORDS: Record<string, string> = {
  'newcomers-arrived': 'Newcomers arrive by ferry',
  'residents-left': 'A few residents leave on the ferry',
  'commuters-stayed-home': 'Some commuters stayed home today',
  'mainland-help': 'Help comes from the Mainland',
  'cargo-arrived': 'Goods come in from the Mainland',
  'goal-completed': 'A goal is reached',
  'island-claimed': 'A new island',
};

export function captionText(caption: Caption): string {
  if (caption.kind === 'ferry') return `The ${caption.trip} ferry comes in`;
  if (caption.kind === 'event') {
    const building = caption.building === null ? null : theBuilding(caption.building);
    if (caption.type === 'construction-finished' && building) return `${capital(building)} is finished`;
    if (caption.type === 'landmark-started' && building) return `Work on ${building} begins`;
    if (caption.type === 'landmark-unlocked' && building) return `${capital(building)} can be built`;
    if (caption.type === 'stage-reached' && caption.stage) return `Welcome to the ${STAGE_NAMES[caption.stage]}`;
    return EVENT_WORDS[caption.type] ?? 'On the island';
  }
  const building = caption.building === null ? 'the island' : theBuilding(caption.building);
  switch (caption.spot) {
    case 'work':
      return `At work at ${building}`;
    case 'site':
      return `Building ${building}`;
    case 'market':
      return 'Evening at the market';
    case 'night':
      return 'Night over the island';
    case 'dock':
      return 'By the dock';
  }
}
