import { content } from '@island/content';
import { TILE_SIZE } from '../render/look.ts';
import { limitsForIsland } from './controller.ts';

/** The camera limits of an island of the sim's size (every island has the same size). */
export const ISLAND_LIMITS = limitsForIsland(content.rules.islandSize, TILE_SIZE);
