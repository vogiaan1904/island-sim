import { useEffect, useRef } from 'react';
import { useGame } from '../session/game.tsx';
import './Compass.css';

const needleTurn = (azimuth: number) => `rotate(${Math.round(((azimuth * 180) / Math.PI) * 100) / 100}deg)`;

/**
 * The compass: its needle points to north on the screen and a tap turns the view to face north. The needle is set
 * straight on the element when the camera changes, never through a React render per frame.
 */
export function Compass() {
  const { store } = useGame();
  const needle = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const show = (azimuth: number) => {
      if (needle.current !== null) needle.current.style.transform = needleTurn(azimuth);
    };
    show(store.getState().view.camera.azimuth);
    let last = store.getState().view.camera.azimuth;
    return store.subscribe((state) => {
      const azimuth = state.view.camera.azimuth;
      if (azimuth === last) return;
      last = azimuth;
      show(azimuth);
    });
  }, [store]);

  return (
    <button className="compass" type="button" aria-label="Face north" onClick={() => store.getState().cameraGesture({ kind: 'face-north' })}>
      <span className="compass-needle" ref={needle} data-testid="compass-needle" style={{ transform: needleTurn(store.getState().view.camera.azimuth) }}>
        <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <path d="M16 3 L22 17 L16 14.5 L10 17 Z" fill="#ff5a5f" stroke="#24323b" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M16 29 L10 17 L16 19.5 L22 17 Z" fill="#ffffff" stroke="#24323b" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}
