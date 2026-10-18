import { content } from '@island/content';
import type { BuildingDef, GoodId } from '@island/content';
import type { MarketState } from '@island/sim';
import { isBuilt, type BuildingState } from '@island/sim';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame, useGameState } from '../../session/game.tsx';
import { Icon } from '../icons.tsx';
import { BUILDING_NAMES, GOOD_NAMES } from '../names.ts';
import { useCommand } from '../useCommand.ts';
import {
  coinsWords,
  landmarkMaterials,
  dockSpot,
  problemOf,
  statusOf,
  type CardContext,
  type Fix,
  type LandmarkMaterials,
  type Picture,
  type Spot,
} from './conditions.ts';
import { useBackClosesCard } from './useBackClosesCard.ts';
import '../PanelHost.css';
import './cards.css';

/** How close "Show me" and Fix bring the camera to the cause (world units from the ground point). */
const FLY_DISTANCE = 60;

/**
 * The card of the tapped building (`view.tappedBuilding`), at once: it comes up from the bottom on a narrow screen and
 * sits on the right on a wide one, like the panels, and replaces any panel that is open. Owner controls (Fix, Buy) are
 * hidden on a visit. Android's back button closes it first.
 */
export function CardHost() {
  const { store } = useGame();
  const tapped = useGameState((state) => state.view.tappedBuilding);
  const island = useGameState((state) => state.island);
  const panelOpen = useGameState((state) => state.view.openPanel !== null);
  const building = tapped === null ? undefined : island?.state.buildings.find((b) => b.id === tapped);
  const open = building !== undefined;
  const close = () => store.getState().setView({ tappedBuilding: null });

  useBackClosesCard(open, close);
  // One at a time: a card opening closes the panel, and a panel opening closes the card.
  useEffect(() => {
    if (open && store.getState().view.openPanel !== null) store.getState().setView({ openPanel: null });
  }, [store, tapped, open]);
  useEffect(() => {
    if (panelOpen && store.getState().view.tappedBuilding !== null) store.getState().setView({ tappedBuilding: null });
  }, [store, panelOpen]);

  if (island === null || building === undefined) return null;
  const market = (island.entities.get('market') as MarketState | undefined) ?? null;
  return <BuildingCard key={building.id} building={building} state={{ island: island.state, content, market }} own={island.own} onClose={close} />;
}

function pictureSrc(picture: Picture): string | null {
  if (picture.kind === 'building') return `/icons/building_${picture.id}_a.png`;
  if (picture.kind === 'good') return `/icons/good_${picture.id}_a.png`;
  return null;
}

function PictureTile({ picture, size = 40 }: { picture: Picture; size?: number }) {
  const src = pictureSrc(picture);
  return (
    <span className="card-picture" aria-hidden="true">
      {src === null && picture.kind === 'icon' ? <Icon name={picture.name} size={size * 0.6} /> : <img src={src ?? ''} alt="" width={size} height={size} draggable={false} />}
    </span>
  );
}

function BuildingCard({ building, state, own, onClose }: { building: BuildingState; state: CardContext; own: boolean; onClose: () => void }) {
  const { store } = useGame();
  const def = state.content.buildings.find((d) => d.id === building.type) as BuildingDef;
  const name = BUILDING_NAMES[def.id];
  const status = statusOf(building, state);
  const problem = useMemo(() => problemOf(building, state), [building, state.island, state.market]);
  const materials = useMemo(() => landmarkMaterials(building, state), [building, state.island, state.market]);

  // The line under the cause: why a Fix that shows the cause moved the camera, or why a command was refused.
  const { send, outcome } = useCommand();
  const [shown, setShown] = useState<string | null>(null);
  const [from, setFrom] = useState<'show' | 'command'>('command');
  const fallback = useRef<Spot>({ x: 0, z: 0 });

  const flyTo = (at: Spot) => store.getState().cameraGesture({ kind: 'fly-to', x: at.x, z: at.z, distance: FLY_DISTANCE });

  // The server refused the command: the camera goes to the cause and the line says why (the words come from useCommand).
  useEffect(() => {
    if (outcome.status === 'refused') flyTo(fallback.current);
  }, [outcome.status]);

  const sendCommand = (command: Parameters<typeof send>[0], at: Spot) => {
    fallback.current = at;
    setFrom('command');
    if (!send(command)) flyTo(at);
  };

  const fix = (plan: Fix) => {
    if (plan.kind === 'show') {
      flyTo(plan.at);
      setFrom('show');
      setShown(plan.why);
      return;
    }
    sendCommand(plan.command, plan.fallback);
  };

  const said = from === 'show' ? shown : outcome.status === 'refused' ? outcome.words : null;
  const busy = outcome.status === 'pending';
  return (
    <section className="panel card" role="region" aria-label={name} data-card={def.id}>
      <header className="panel-head card-head">
        <span className="card-portrait">
          <img src={`/icons/building_${def.id}_a.png`} alt={name} width={64} height={64} draggable={false} />
        </span>
        <div className="card-title">
          <h2 className="panel-title">{name}</h2>
          <p className="card-status" data-problem={status.problem} data-condition={status.condition}>
            <Icon name={status.icon} size={18} />
            <span>{status.words}</span>
          </p>
        </div>
        <button className="panel-close" type="button" aria-label="Close" onClick={onClose}>
          <Icon name="x" size={18} strokeWidth={3} />
        </button>
      </header>
      <div className="panel-body card-body">
        <Makes building={building} def={def} />
        <Crew building={building} def={def} />
        {materials !== null && <Materials materials={materials} own={own} busy={busy} onBuy={() => sendCommand({ type: 'buy-materials', buildingId: building.id }, dockSpot(building, state))} />}
        {problem !== null && (
          <div className="card-problem">
            <PictureTile picture={problem.picture} />
            <div className="card-problem-text">
              <p>{problem.cause}</p>
              {own && <p className="card-problem-says">{problem.fix.kind === 'command' ? problem.fix.says : 'Fix takes you to the cause.'}</p>}
              <p className="card-said" role="status">
                {said}
              </p>
            </div>
            {own && (
              <button className="card-fix" type="button" disabled={busy} onClick={() => fix(problem.fix)}>
                Fix
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function GoodTile({ good, count }: { good: GoodId; count: number }) {
  return (
    <li className="card-good">
      <img src={`/icons/good_${good}_a.png`} alt={GOOD_NAMES[good]} width={36} height={36} draggable={false} />
      <span className="card-badge">{count}</span>
    </li>
  );
}

/** What it makes (a workplace) or what it holds (a store), as goods pictures with a count badge. */
function Makes({ building, def }: { building: BuildingState; def: BuildingDef }) {
  if (!isBuilt(building)) return null;
  if (def.recipe !== null) {
    return (
      <ul className="card-goods" aria-label="Makes">
        <GoodTile good={def.recipe.good} count={building.stock[def.recipe.good] ?? 0} />
      </ul>
    );
  }
  if (def.isStore) {
    const held = (Object.entries(building.stock) as Array<[GoodId, number]>).filter(([, count]) => count > 0);
    if (held.length === 0) return <p className="card-note">Nothing stored yet.</p>;
    return (
      <ul className="card-goods" aria-label="Stores">
        {held.map(([good, count]) => (
          <GoodTile key={good} good={good} count={count} />
        ))}
      </ul>
    );
  }
  return null;
}

/** Workers (or residents) as little heads: filled for each one, dashed for each open place. Counts, not people. */
function Crew({ building, def }: { building: BuildingState; def: BuildingDef }) {
  if (!isBuilt(building)) return null;
  const [filled, total, noun] =
    building.work !== null
      ? [building.work.residents + building.work.commuters, def.jobs, 'workers']
      : building.home !== null
        ? [building.home.residents, def.homeCapacity, 'residents']
        : [0, 0, ''];
  if (total === 0) return null;
  return (
    <div className="card-heads" role="img" aria-label={`${filled} of ${total} ${noun}`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} data-filled={i < filled} />
      ))}
    </div>
  );
}

function Materials({
  materials,
  own,
  busy,
  onBuy,
}: {
  materials: LandmarkMaterials;
  own: boolean;
  busy: boolean;
  onBuy: () => void;
}) {
  const missing = materials.lines.reduce((sum, line) => sum + line.missing, 0);
  const onTheFerry = materials.lines.some((line) => line.onTheFerry > 0);
  const onTheRoad = materials.lines.some((line) => line.onTheRoad > 0);
  const short = materials.shortfallCents > 0;
  return (
    <div className="card-materials">
      <ul className="card-goods" aria-label="Materials">
        {materials.lines.map((line) => {
          const way = line.onTheRoad + line.onTheFerry;
          const label = [`${GOOD_NAMES[line.good]}: ${line.stored} of ${line.need} stored`, way > 0 ? `${way} on the way` : null, line.missing > 0 ? `${line.missing} to buy` : null]
            .filter((part) => part !== null)
            .join(', ');
          return (
            <li className="card-material" key={line.good} aria-label={label}>
              <img src={`/icons/good_${line.good}_a.png`} alt="" width={36} height={36} draggable={false} />
              <span className="card-material-count" aria-hidden="true">
                {line.stored} / {line.need}
              </span>
              {way > 0 && (
                <span className="card-material-way" aria-hidden="true">
                  +{way}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {onTheFerry ? <p className="card-note">Coming on the next ferry</p> : onTheRoad ? <p className="card-note">On their way to the site</p> : null}
      {own && missing > 0 && (
        <button className="card-buy" type="button" disabled={busy || short} onClick={onBuy}>
          {short ? (
            `Need ${coinsWords(materials.shortfallCents)} more coins`
          ) : (
            <>
              <span>Buy</span>
              <Icon name="coin" size={20} />
              <span>{coinsWords(materials.costCents)}</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
