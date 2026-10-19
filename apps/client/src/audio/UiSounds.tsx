import { useEffect } from 'react';
import { useGame } from '../session/game.tsx';
import type { ClientState } from '../store/mirror.ts';
import { audio, type AudioEngine } from './engine.ts';

/**
 * The soft UI sounds (spec 6.2; island-ui): a tap for every button press and for a building's card opening from the
 * island, the landing once the server accepted a placement, a chime once a reward is collected. They play through the
 * shared audio engine, so mute, the first-gesture rule and the hidden page apply to them too. Renders nothing.
 */
export function UiSounds({ engine = audio }: { engine?: AudioEngine }) {
  const { store } = useGame();

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('button') !== null) engine.play('tap');
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, [engine]);

  useEffect(
    () =>
      store.subscribe((next: ClientState, before: ClientState) => {
        const tapped = next.view.tappedBuilding;
        if (tapped !== null && tapped !== before.view.tappedBuilding) engine.play('tap');
        if (next.view.placement?.phase === 'landing' && before.view.placement?.phase !== 'landing') engine.play('land');
        if (next.commands !== before.commands) {
          for (const [id, command] of Object.entries(next.commands)) {
            const was = before.commands[Number(id)];
            if (command.command.type === 'collect' && command.status === 'ok' && was?.status !== 'ok') engine.play('collect');
          }
        }
      }),
    [store, engine],
  );

  return null;
}
