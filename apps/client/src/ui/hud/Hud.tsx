import { content } from '@island/content';
import { useMemo } from 'react';
import { NewsCard } from '../../news/NewsCard.tsx';
import { StageCelebration } from '../../news/StageCelebration.tsx';
import { useGame, useGameState } from '../../session/game.tsx';
import type { PanelId } from '../../store/view.ts';
import { CardHost } from '../cards/CardHost.tsx';
import { Compass } from '../Compass.tsx';
import { Icon, type IconName } from '../icons.tsx';
import { STAGE_NAMES } from '../names.ts';
import { PanelHost } from '../PanelHost.tsx';
import { PANEL_BODIES, PANEL_TITLES } from '../panels.ts';
import { GlidingNumber } from './GlidingNumber.tsx';
import { hudModel, type GoalTile, type HudModel, type StageRing } from './model.ts';
import './Hud.css';

/**
 * The HUD over the island (island-ui, screens.md section 1): the stage badge with its progress ring, the counters, the
 * goal icons, the gear and compass, and the round bottom buttons. Nothing else is always visible. The bottom buttons
 * and the gear only set `view.openPanel`; `PanelHost` shows the panel and `panels.ts` is where its body plugs in.
 */
export function Hud() {
  const island = useGameState((state) => state.island);
  // A panel or a building card on the island: the wide layout leaves room on the right for either.
  const panelOpen = useGameState((state) => state.view.openPanel !== null || state.view.tappedBuilding !== null);
  const model = useMemo(() => (island === null ? null : hudModel(island.state, content)), [island?.state]);
  if (island === null || model === null) return null;
  const glideKey = `${island.world}/${island.slot}`;
  return (
    <>
      <div className="hud" data-panel-open={panelOpen}>
        <StageBadge model={model} />
        <div className="hud-right">
          <Counters model={model} glideKey={glideKey} />
          <SideButtons />
        </div>
        {island.own && <Goals tiles={model.goals} />}
        {island.own && <BottomBar />}
        <NewsCard />
      </div>
      <StageCelebration />
      <PanelHost bodies={PANEL_BODIES} />
      <CardHost />
    </>
  );
}

const RING_ICON: Record<StageRing['phase'], IconName> = { residents: 'users', landmark: 'hammer', complete: 'palm' };

/** The stage name, with a ring that fills with residents toward the landmark and then with the landmark itself. */
function StageBadge({ model }: { model: HudModel }) {
  const percent = Math.round(model.ring.fraction * 100);
  return (
    <div className="hud-badge">
      <div className="hud-ring" role="progressbar" aria-label="Progress to the next stage" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} data-phase={model.ring.phase}>
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <circle className="hud-ring-track" cx="32" cy="32" r="28" pathLength="100" />
          <circle className="hud-ring-fill" cx="32" cy="32" r="28" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - percent} />
        </svg>
        <span className="hud-disc">
          <Icon name={RING_ICON[model.ring.phase]} size={22} />
        </span>
      </div>
      <span className="hud-stage-name">{STAGE_NAMES[model.stage]}</span>
    </div>
  );
}

function Counters({ model, glideKey }: { model: HudModel; glideKey: string }) {
  return (
    <div className="hud-counters">
      <Pill label="Coins" icon="coin" value={model.coins} glideKey={glideKey} />
      <Pill label="Residents" icon="users" value={model.residents} glideKey={glideKey} />
      {model.commuters !== null && <Pill label="Commuters" icon="anchor" value={model.commuters} glideKey={glideKey} />}
    </div>
  );
}

function Pill({ label, icon, value, glideKey }: { label: string; icon: IconName; value: number; glideKey: string }) {
  return (
    <div className="hud-pill" role="group" aria-label={`${label}: ${value.toLocaleString('en-US')}`}>
      <span className="hud-pill-icon">
        <Icon name={icon} size={22} />
      </span>
      <GlidingNumber value={value} resetKey={`${glideKey}/${label}`} />
    </div>
  );
}

function Goals({ tiles }: { tiles: readonly GoalTile[] }) {
  if (tiles.length === 0) return null;
  return (
    <ul className="hud-goals" aria-label="Goals">
      {tiles.map((tile) => (
        <li className="hud-goal" key={`${tile.kind}-${tile.id}`} aria-label={tile.label} title={tile.label} data-kind={tile.kind}>
          {tile.picture.kind === 'building' ? (
            <img src={`/icons/building_${tile.picture.building}_a.png`} alt="" width={32} height={32} draggable={false} />
          ) : (
            <Icon name={tile.picture.name} size={26} />
          )}
          <span className="hud-goal-bar" aria-hidden="true">
            <i style={{ width: `${Math.round(tile.fraction * 100)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The gear (Settings) beside the compass, under the counters. */
function SideButtons() {
  const { store } = useGame();
  const open = useGameState((state) => state.view.openPanel === 'settings');
  return (
    <div className="hud-side">
      <button className="hud-gear" type="button" aria-label="Settings" aria-pressed={open} onClick={() => store.getState().togglePanel('settings')}>
        <Icon name="settings" size={24} />
      </button>
      <Compass />
    </div>
  );
}

const BOTTOM_BUTTONS: ReadonlyArray<{ panel: PanelId; icon: IconName; big?: true }> = [
  { panel: 'staff', icon: 'staff' },
  { panel: 'trade', icon: 'anchor' },
  { panel: 'build', icon: 'hammer', big: true },
  { panel: 'log', icon: 'book' },
];

/** Staff, Trade, Build (big, in the centre) and Log: round buttons, each opening its panel. No Views until the first view exists. */
function BottomBar() {
  const { store } = useGame();
  const open = useGameState((state) => state.view.openPanel);
  return (
    <div className="hud-bar" role="toolbar" aria-label="Main actions">
      {BOTTOM_BUTTONS.map(({ panel, icon, big }) => (
        <button
          key={panel}
          className={big ? 'hud-btn hud-btn-build' : 'hud-btn'}
          type="button"
          aria-pressed={open === panel}
          onClick={() => store.getState().togglePanel(panel)}
        >
          <span className="hud-btn-disc">
            <Icon name={icon} size={big ? 32 : 24} strokeWidth={big ? 2.2 : 2} />
          </span>
          <span className="hud-btn-label">{PANEL_TITLES[panel]}</span>
        </button>
      ))}
    </div>
  );
}
