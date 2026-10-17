export { PERMILLE, applyPermille, mulDivFloor } from './int.ts';
export { canonicalJson, stateHash } from './hash.ts';
export type { BuildingState, IslandState, Rotation, WorldState } from './state.ts';
export { createWorld } from './world.ts';
export { SIM_VERSION } from './version.ts';
export type { PlacementCheck, PlacementCheckId, PlacementReport } from './placement.ts';
export { checkPlacement, findDockSpot, footprintSize, footprintTiles } from './placement.ts';
