import { content } from '@island/content';
import { fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { startDraft } from '../placement/draft.ts';
import { createGameStore, type GameStore } from '../store/store.ts';
import { useCameraInput } from './useCameraInput.ts';

// jsdom has no pointer capture; the gesture library asks for it on the first touch.
beforeAll(() => {
  Object.assign(HTMLElement.prototype, { setPointerCapture: () => {}, releasePointerCapture: () => {}, hasPointerCapture: () => false });
  HTMLElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, right: 400, bottom: 800, width: 400, height: 800, x: 0, y: 0, toJSON: () => ({}) });
});

// The acceptance criterion "placement drags do not move the camera", through the real input binding on a real element.

function Bound({ element, store, onAim }: { element: HTMLElement; store: GameStore; onAim: (x: number, y: number, pointer: 'touch' | 'mouse') => void }) {
  useCameraInput({ element, store, onTap: () => true, onAim });
  return null;
}

function Surface({ store, onAim }: { store: GameStore; onAim: (x: number, y: number, pointer: 'touch' | 'mouse') => void }) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  return (
    <div ref={setElement} data-testid="surface">
      {element !== null && <Bound element={element} store={store} onAim={onAim} />}
    </div>
  );
}

function drag(surface: HTMLElement, pointerType: 'touch' | 'mouse', from: [number, number], to: [number, number]) {
  const init = { pointerId: 1, pointerType, isPrimary: true, buttons: 1, button: 0 };
  fireEvent.pointerDown(surface, { ...init, clientX: from[0], clientY: from[1] });
  fireEvent.pointerMove(surface, { ...init, clientX: (from[0] + to[0]) / 2, clientY: (from[1] + to[1]) / 2 });
  fireEvent.pointerMove(surface, { ...init, clientX: to[0], clientY: to[1] });
  fireEvent.pointerUp(surface, { ...init, buttons: 0, clientX: to[0], clientY: to[1] });
}

describe('dragging while placing', () => {
  it('moves the camera when nothing is being placed (the drag does reach the binding)', () => {
    const store = createGameStore();
    const before = store.getState().view.camera;
    const view = render(<Surface store={store} onAim={vi.fn()} />);
    drag(view.getByTestId('surface'), 'touch', [100, 100], [180, 160]);
    expect(store.getState().view.camera).not.toBe(before);
  });

  it('aims the ghost and leaves the camera alone while a building is being placed', () => {
    const store = createGameStore();
    store.getState().setView({ placement: startDraft('cottage', { x: 10, y: 10 }, content) });
    const before = store.getState().view.camera;
    const onAim = vi.fn();
    const view = render(<Surface store={store} onAim={onAim} />);
    drag(view.getByTestId('surface'), 'touch', [100, 100], [180, 160]);
    expect(store.getState().view.camera).toBe(before);
    expect(onAim).toHaveBeenCalled();
    expect(onAim).toHaveBeenLastCalledWith(180, 160, 'touch');
  });

  it('moves the camera again once the placement is over', () => {
    const store = createGameStore();
    store.getState().setView({ placement: startDraft('cottage', { x: 10, y: 10 }, content) });
    const view = render(<Surface store={store} onAim={vi.fn()} />);
    store.getState().setView({ placement: null });
    const before = store.getState().view.camera;
    drag(view.getByTestId('surface'), 'touch', [100, 100], [180, 160]);
    expect(store.getState().view.camera).not.toBe(before);
  });

  it('follows a mouse cursor with no button down', () => {
    const store = createGameStore();
    store.getState().setView({ placement: startDraft('cottage', { x: 10, y: 10 }, content) });
    const onAim = vi.fn();
    const view = render(<Surface store={store} onAim={onAim} />);
    fireEvent.pointerMove(view.getByTestId('surface'), { pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 0, clientX: 40, clientY: 50 });
    expect(onAim).toHaveBeenLastCalledWith(40, 50, 'mouse');
  });

  it('turns a tap into an aim and does not select a building under it', () => {
    const store = createGameStore();
    store.getState().setView({ placement: startDraft('cottage', { x: 10, y: 10 }, content) });
    const onAim = vi.fn();
    const onTap = vi.fn(() => true);
    function Tapped() {
      const [element, setElement] = useState<HTMLElement | null>(null);
      return (
        <div ref={setElement} data-testid="surface">
          {element !== null && <Inner element={element} />}
        </div>
      );
    }
    function Inner({ element }: { element: HTMLElement }) {
      useCameraInput({ element, store, onTap, onAim });
      return null;
    }
    const view = render(<Tapped />);
    const surface = view.getByTestId('surface');
    const init = { pointerId: 1, pointerType: 'touch', isPrimary: true, buttons: 1, button: 0, clientX: 70, clientY: 90 };
    fireEvent.pointerDown(surface, init);
    fireEvent.pointerMove(surface, { ...init, clientX: 71, clientY: 90 });
    fireEvent.pointerUp(surface, { ...init, buttons: 0, clientX: 71, clientY: 90 });
    expect(onAim).toHaveBeenLastCalledWith(71, 90, 'touch');
    expect(onTap).not.toHaveBeenCalled();
  });
});
