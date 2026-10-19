import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameProvider } from '../session/game.tsx';
import { stubGame } from '../test/game.ts';
import { aliceWorld, islandMessage } from '../test/islands.ts';
import { Ambience, MIX_STEP_MS } from './Ambience.tsx';
import type { AudioEngine } from './engine.ts';

function fakeEngine() {
  return { unlock: vi.fn(), ready: Promise.resolve(), setMix: vi.fn(), setMuted: vi.fn(), setHidden: vi.fn(), play: vi.fn() } satisfies AudioEngine;
}

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
  document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => {
  setHidden(false);
  vi.useRealTimers();
});

describe('the ambience', () => {
  it('waits for the first touch or key before any sound, then follows the camera a few times a second', () => {
    vi.useFakeTimers();
    const game = stubGame('playing');
    game.store.getState().receive({ ...islandMessage(aliceWorld()), own: true });
    const engine = fakeEngine();
    render(
      <GameProvider game={game}>
        <Ambience engine={engine} />
      </GameProvider>,
    );
    expect(engine.unlock).not.toHaveBeenCalled();
    fireEvent.pointerDown(window);
    expect(engine.unlock).toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(MIX_STEP_MS * 2));
    expect(engine.setMix).toHaveBeenCalled();
    const gains = engine.setMix.mock.calls.at(-1)?.[0];
    expect(Object.keys(gains ?? {}).sort()).toEqual(['birds', 'night', 'town', 'waves']);
  });

  it('follows the mute switch at once, and stops while the page is hidden', () => {
    const game = stubGame('playing');
    const engine = fakeEngine();
    render(
      <GameProvider game={game}>
        <Ambience engine={engine} />
      </GameProvider>,
    );
    expect(engine.setMuted).toHaveBeenLastCalledWith(false);
    act(() => game.store.getState().setView({ muted: true }));
    expect(engine.setMuted).toHaveBeenLastCalledWith(true);
    act(() => setHidden(true));
    expect(engine.setHidden).toHaveBeenLastCalledWith(true);
    act(() => setHidden(false));
    expect(engine.setHidden).toHaveBeenLastCalledWith(false);
  });
});
