import { content } from '@island/content';
import type { SimEvent } from '@island/sim';
import type { GameStore } from '../store/store.ts';
import { eventPlace } from './words.ts';

/** How close "Show me" looks: near enough to see the building, with the street around it. */
export const SHOW_ME_DISTANCE = 44;

/** "Show me": the camera glides to the place of the event on the open island (the free camera's fly-to). */
export function showMe(store: GameStore, event: SimEvent): void {
  const island = store.getState().island;
  if (island === null) return;
  const { x, z } = eventPlace(island.state, content, event);
  store.getState().cameraGesture({ kind: 'fly-to', x, z, distance: SHOW_ME_DISTANCE });
}
