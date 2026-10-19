import { content } from '@island/content';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { startDraft } from '../placement/draft.ts';
import { GameProvider, type Game } from '../session/game.tsx';
import { stubGame } from '../test/game.ts';
import { aliceWorld, islandMessage } from '../test/islands.ts';
import type { AudioEngine } from './engine.ts';
import { UiSounds } from './UiSounds.tsx';

function setup(): { game: Game; engine: AudioEngine & { play: ReturnType<typeof vi.fn> } } {
  const game = stubGame('playing');
  game.store.getState().receive({ ...islandMessage(aliceWorld()), own: true });
  const engine = { unlock: vi.fn(), ready: Promise.resolve(), setMix: vi.fn(), setMuted: vi.fn(), setHidden: vi.fn(), play: vi.fn() };
  render(
    <GameProvider game={game}>
      <UiSounds engine={engine} />
      <button type="button">Build</button>
    </GameProvider>,
  );
  return { game, engine };
}

describe('the button sounds', () => {
  it('tap once for a button press', async () => {
    const { engine } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Build' }));
    expect(engine.play.mock.calls).toEqual([['tap']]);
  });

  it('tap once when a building\'s card opens from the island', () => {
    const { game, engine } = setup();
    act(() => game.store.getState().setView({ tappedBuilding: 1 }));
    act(() => game.store.getState().setView({ tappedBuilding: 1 }));
    expect(engine.play.mock.calls).toEqual([['tap']]);
  });

  it('play the landing once, when the server has accepted the placement', () => {
    const { game, engine } = setup();
    const draft = { ...startDraft('farm', { x: 30, y: 50 }, content), phase: 'placing' as const };
    act(() => game.store.getState().setView({ placement: draft }));
    expect(engine.play).not.toHaveBeenCalled();
    act(() => game.store.getState().setView({ placement: { ...draft, phase: 'landing' } }));
    act(() => game.store.getState().setView({ placement: { ...draft, phase: 'landing' } }));
    expect(engine.play.mock.calls).toEqual([['land']]);
  });

  it('chime once when a reward is collected, and not when the server refuses', () => {
    const { game, engine } = setup();
    const state = () => game.store.getState();
    act(() => state().commandSent(1, { type: 'collect', goal: 'first-farm' }));
    act(() => state().receive({ type: 'result', requestId: 1, ok: false, reason: 'nothing-to-collect' } as never));
    act(() => state().commandSent(2, { type: 'collect', goal: 'first-farm' }));
    act(() => state().receive({ type: 'result', requestId: 2, ok: true, data: { cents: 100 } } as never));
    expect(engine.play.mock.calls).toEqual([['collect']]);
  });
});
