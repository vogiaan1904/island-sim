import { content } from '@island/content';
import { useMemo } from 'react';
import { cameraPose } from '../../camera/controller.ts';
import { ISLAND_LIMITS } from '../../camera/limits.ts';
import { startDraft, tileAtWorld } from '../../placement/draft.ts';
import { buildingOptions, type BuildingOption } from '../../placement/verdict.ts';
import { useGame, useGameState } from '../../session/game.tsx';
import { Icon } from '../icons.tsx';
import './Build.css';

/**
 * The Build panel's body: every building the player can place with its picture, name and cost. One that costs more than
 * the island has says how many coins it needs and can still be picked (the ghost shows, Place waits); a landmark that is
 * still locked says what unlocks it and cannot be picked. Picking one closes the panel and starts the placement at the
 * middle of the view.
 */
export function BuildPicker() {
  const { store } = useGame();
  const island = useGameState((state) => state.island?.state ?? null);
  const options = useMemo(() => (island === null ? [] : buildingOptions(island, content)), [island]);
  const pick = (option: BuildingOption) => {
    const camera = store.getState().view.camera;
    const pose = cameraPose(camera, ISLAND_LIMITS);
    store.getState().setView({ placement: startDraft(option.id, tileAtWorld(pose.x, pose.z, content), content), openPanel: null });
  };
  return (
    <ul className="build-list" aria-label="Buildings">
      {options.map((option) => (
        <li key={option.id}>
          <button className="build-row" type="button" data-state={option.state.kind} disabled={option.state.kind === 'locked'} onClick={() => pick(option)}>
            <span className="build-picture">
              <img src={`/icons/building_${option.id}_a.png`} alt="" width={48} height={48} draggable={false} />
            </span>
            <span className="build-text">
              <span className="build-name">{option.name}</span>
              {option.state.kind !== 'ready' && <span className="build-note">{option.state.text}</span>}
            </span>
            <span className="build-cost">
              <Icon name="coin" size={18} />
              {option.coins.toLocaleString('en-US')}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
