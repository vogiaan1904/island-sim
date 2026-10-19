import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameProvider, type Game } from '../../session/game.tsx';
import { stubGame } from '../../test/game.ts';
import { aliceWorld, islandMessage } from '../../test/islands.ts';
import { expectNoEmoji } from '../../test/no-emoji.ts';
import { Hud } from '../hud/Hud.tsx';
import { setLivePose } from '../../camera/livePose.ts';
import { captionText } from './caption.ts';
import { Watch, WATCH_STEP_MS } from './Watch.tsx';

function game(): Game {
  const g = stubGame('playing');
  g.store.getState().receive({ ...islandMessage(aliceWorld()), own: true });
  g.clock.reset(1500, performance.now());
  return g;
}

function renderWatch(g: Game) {
  return render(
    <GameProvider game={g}>
      <Hud />
      <Watch />
    </GameProvider>,
  );
}

const watching = (g: Game) => g.store.getState().view.cameraMode === 'watch';

let wakeLock: { request: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };

beforeEach(() => {
  const release = vi.fn(() => Promise.resolve());
  wakeLock = { request: vi.fn(() => Promise.resolve({ release })), release };
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: wakeLock.request } });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('watch mode', () => {
  it('starts from the Watch button: the HUD fades, a caption says what is shown, and the camera goes there', async () => {
    const g = game();
    renderWatch(g);
    const before = g.store.getState().view.camera;
    await userEvent.click(screen.getByRole('button', { name: 'Watch' }));
    expect(watching(g)).toBe(true);
    expect(document.querySelector('.hud')?.getAttribute('data-watching')).toBe('true');
    await act(() => new Promise((r) => setTimeout(r, WATCH_STEP_MS + 50)));
    const caption = screen.getByRole('status');
    expect(caption.textContent).not.toBe('');
    expectNoEmoji(caption.textContent ?? '');
    expect(g.store.getState().view.camera).not.toEqual(before);
  });

  it('starts with V and keeps the screen awake while it runs', async () => {
    const g = game();
    renderWatch(g);
    fireEvent.keyDown(window, { key: 'v', code: 'KeyV' });
    expect(watching(g)).toBe(true);
    await act(() => Promise.resolve());
    expect(wakeLock.request).toHaveBeenCalledWith('screen');
    fireEvent.keyDown(window, { key: 'a', code: 'KeyA' });
    expect(watching(g)).toBe(false);
    await act(() => Promise.resolve());
    expect(wakeLock.release).toHaveBeenCalled();
  });

  it('stops on any touch, and that touch does nothing else', () => {
    const g = game();
    renderWatch(g);
    act(() => g.store.getState().setView({ cameraMode: 'watch' }));
    const touch = new Event('pointerdown', { bubbles: true, cancelable: true });
    const reached = vi.fn();
    document.body.addEventListener('pointerdown', reached);
    document.body.dispatchEvent(touch);
    expect(watching(g)).toBe(false);
    expect(touch.defaultPrevented).toBe(true);
    expect(reached).not.toHaveBeenCalled();
    document.body.removeEventListener('pointerdown', reached);
  });

  it('closes an open panel or card when it starts, and V does nothing while typing', () => {
    const g = game();
    renderWatch(g);
    act(() => g.store.getState().setView({ openPanel: 'log', tappedBuilding: 1 }));
    fireEvent.keyDown(window, { key: 'v', code: 'KeyV' });
    expect(g.store.getState().view).toMatchObject({ cameraMode: 'watch', openPanel: null, tappedBuilding: null });
    act(() => g.store.getState().setView({ cameraMode: 'free' }));
    const field = document.createElement('input');
    document.body.append(field);
    fireEvent.keyDown(field, { key: 'v', code: 'KeyV' });
    expect(watching(g)).toBe(false);
    field.remove();
  });
});

describe('watch mode moving the camera', () => {
  it('flies only when the moment changes, and leaves the slow turn to the camera rig', () => {
    vi.useFakeTimers();
    const g = game();
    renderWatch(g);
    act(() => g.store.getState().setView({ cameraMode: 'watch' }));
    act(() => vi.advanceTimersByTime(WATCH_STEP_MS));
    const first = g.store.getState().view.camera;
    act(() => vi.advanceTimersByTime(WATCH_STEP_MS * 4));
    expect(g.store.getState().view.camera).toBe(first);
  });

  it('hands the camera back where it is when watching stops', () => {
    vi.useFakeTimers();
    const g = game();
    renderWatch(g);
    act(() => g.store.getState().setView({ cameraMode: 'watch' }));
    act(() => vi.advanceTimersByTime(WATCH_STEP_MS));
    setLivePose({ x: 100, z: 120, distance: 40, azimuth: 2.5, polar: 0.9 });
    act(() => {
      fireEvent.keyDown(window, { key: 'a', code: 'KeyA' });
    });
    expect(g.store.getState().view.camera.azimuth).toBeCloseTo(2.5);
    setLivePose(null);
  });
});

describe('watch captions', () => {
  it('say what each moment is in plain words, with no emoji', () => {
    const texts = [
      captionText({ kind: 'ferry', trip: 'morning' }),
      captionText({ kind: 'ferry', trip: 'evening' }),
      captionText({ kind: 'event', type: 'construction-finished', building: 'farm', stage: null }),
      captionText({ kind: 'event', type: 'stage-reached', building: null, stage: 'settlement' }),
      captionText({ kind: 'event', type: 'newcomers-arrived', building: null, stage: null }),
      captionText({ kind: 'tour', spot: 'work', building: 'lumber-camp' }),
      captionText({ kind: 'tour', spot: 'site', building: 'island-hall' }),
      captionText({ kind: 'tour', spot: 'market', building: 'market' }),
      captionText({ kind: 'tour', spot: 'night', building: 'cottage' }),
      captionText({ kind: 'tour', spot: 'dock', building: 'dock' }),
    ];
    expect(texts).toEqual([
      'The morning ferry comes in',
      'The evening ferry comes in',
      'The farm is finished',
      'Welcome to the Settlement',
      'Newcomers arrive by ferry',
      'At work at the lumber camp',
      'Building the Island Hall',
      'Evening at the market',
      'Night over the island',
      'By the dock',
    ]);
    for (const text of texts) expectNoEmoji(text);
  });
});
