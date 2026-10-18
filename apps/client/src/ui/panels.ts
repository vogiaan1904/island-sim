import type { ComponentType } from 'react';
import type { PanelId } from '../store/view.ts';

// The hook for the panels the HUD opens (ticket 11). The bottom buttons and the gear set `view.openPanel`; the panel
// host shows its title and a Close button, and renders the body registered here for that panel. A ticket that fills a
// panel adds ONE line to PANEL_BODIES (its component, which reads the store with `useGameState`) and nothing else:
//
//   build: BuildPicker,      (ticket 12)
//   staff: StaffPanel,       (ticket 16)
//   trade: TradePanel,       (ticket 16)
//   log: LogPanel,           (ticket 17)
//   settings: SettingsPanel, (ticket 18)

export const PANEL_TITLES: Record<PanelId, string> = {
  staff: 'Staff',
  trade: 'Trade',
  build: 'Build',
  log: 'Log',
  settings: 'Settings',
};

export type PanelBodies = Partial<Record<PanelId, ComponentType>>;

export const PANEL_BODIES: PanelBodies = {};
