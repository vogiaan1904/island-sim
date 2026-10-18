import { content } from '@island/content';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { cameraPose } from '../../camera/controller.ts';
import { getLivePose } from '../../camera/livePose.ts';
import { ISLAND_LIMITS } from '../../camera/limits.ts';
import { projectPoint } from '../../render/anchors.ts';
import { useGame, useGameState } from '../../session/game.tsx';
import { goodPicture } from '../names.ts';
import { Icon } from '../icons.tsx';
import { NOT_SENT_WORDS, reasonWords } from '../reasonWords.ts';
import type { Picture } from '../cards/conditions.ts';
import { bubbleDetail, bubblesOf, shownBubbles, type Bubble, type BubbleDetail, type RewardBubble } from './bubbles.ts';
import './bubbles.css';

/** Side by side bubbles over one building stand this far apart on the screen. */
const STACK_PX = 46;
const DOT_STACK_PX = 22;
/** How many coins fly from a collected reward, and how long the whole flight lasts including the last coin's delay. */
const COINS_PER_REWARD = 6;
const COIN_DELAY_MS = 70;
const FLIGHT_MS = 700;
const SAY_MS = 4000;

interface Spot {
  x: number;
  y: number;
}

interface Pending {
  requestId: number;
  goal: string;
  from: Spot;
}

interface Flight {
  id: number;
  from: Spot;
  to: Spot;
}

const reducedMotion = (): boolean => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function pictureOf(picture: Picture) {
  if (picture.kind === 'icon') return <Icon name={picture.name} size={22} strokeWidth={2.4} />;
  const src = picture.kind === 'good' ? goodPicture(picture.id) : `/icons/building_${picture.id}_a.png`;
  return <img src={src} alt="" width={26} height={26} draggable={false} />;
}

/** The coin counter's middle on the screen, or null if the HUD has none up. */
function counterSpot(root: HTMLElement | null): Spot | null {
  const counter = document.querySelector('[data-counter="coins"]');
  if (counter === null || root === null) return null;
  const box = counter.getBoundingClientRect();
  const origin = root.getBoundingClientRect();
  return { x: box.left + box.width / 2 - origin.left, y: box.top + box.height / 2 - origin.top };
}

/** A small pop of the counter when coins land (a CSS animation; none with reduced motion). */
function popCounter(): void {
  const counter = document.querySelector('[data-counter="coins"]');
  if (counter === null) return;
  counter.setAttribute('data-pop', 'true');
  window.setTimeout(() => counter.removeAttribute('data-pop'), 400);
}

/**
 * The bubbles over the island (island-ui, screens.md sections 2 and 3): problems, wishes and rewards, each floating over
 * its building and following it as the camera moves; zoomed out to the whole island they shrink to dots and only the
 * problems stay. The list changes with the mirror, the positions every frame, straight on the elements, so a moving
 * camera never re-renders React. A tap on a problem or a wish opens the building's card; a tap on a reward sends
 * `collect`, and the coins fly to the counter on the server's ok only (the reward leaves the island with the update,
 * which comes before the result, so the flight starts from where the bubble was).
 */
export function BubbleLayer() {
  const { store, session } = useGame();
  const island = useGameState((state) => state.island);
  const commands = useGameState((state) => state.commands);
  const [detail, setDetail] = useState<BubbleDetail>('full');
  const [pending, setPending] = useState<readonly Pending[]>([]);
  const [flights, setFlights] = useState<readonly Flight[]>([]);
  const [said, setSaid] = useState<string | null>(null);

  const all = useMemo(
    () => (island === null ? [] : bubblesOf({ island: island.state, content, market: null }, island.own)),
    [island?.state, island?.own],
  );
  const shown = useMemo(() => shownBubbles(all, detail), [all, detail]);

  const root = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const spots = useRef(new Map<string, Spot>());
  const shownRef = useRef<readonly Bubble[]>(shown);
  const detailRef = useRef<BubbleDetail>('full');
  const flightId = useRef(0);
  shownRef.current = shown;

  const place = useCallback(() => {
    const layer = root.current;
    if (layer === null) return;
    const pose = getLivePose() ?? cameraPose(store.getState().view.camera, ISLAND_LIMITS);
    const next = bubbleDetail(pose.distance, ISLAND_LIMITS);
    if (next !== detailRef.current) {
      detailRef.current = next;
      setDetail(next);
    }
    const box = layer.getBoundingClientRect();
    const viewport = { width: box.width || window.innerWidth, height: box.height || window.innerHeight };
    for (const bubble of shownRef.current) {
      const element = nodes.current.get(bubble.key);
      if (element === undefined) continue;
      const point = projectPoint(pose, viewport, bubble.anchor);
      const step = detailRef.current === 'dots' ? DOT_STACK_PX : STACK_PX;
      const x = point.x + (bubble.stack.index - (bubble.stack.of - 1) / 2) * step;
      element.style.transform = `translate(${x.toFixed(1)}px, ${point.y.toFixed(1)}px)`;
      element.style.visibility = point.visible ? 'visible' : 'hidden';
      spots.current.set(bubble.key, { x, y: point.y });
    }
  }, [store]);

  // Right after every render (a new list, a new detail), then every frame while the page is shown.
  useLayoutEffect(place, [place, shown]);
  useEffect(() => {
    let frame = requestAnimationFrame(function run() {
      place();
      frame = requestAnimationFrame(run);
    });
    return () => cancelAnimationFrame(frame);
  }, [place]);

  // Follow the commands the rewards sent: coins on ok, words on a refusal.
  useEffect(() => {
    if (pending.length === 0) return;
    const rest: Pending[] = [];
    const landed: Pending[] = [];
    let words: string | null = null;
    for (const entry of pending) {
      const command = commands[entry.requestId];
      if (command === undefined) words = NOT_SENT_WORDS; // lost with a dropped connection
      else if (command.status === 'pending') rest.push(entry);
      else if (command.status === 'ok') landed.push(entry);
      else words = reasonWords(command.reason, command.shortfallCents);
    }
    if (rest.length === pending.length) return;
    setPending(rest);
    if (words !== null) setSaid(words);
    const to = counterSpot(root.current);
    if (landed.length > 0 && to !== null && !reducedMotion()) {
      setFlights((current) => [...current, ...landed.map((entry) => ({ id: ++flightId.current, from: entry.from, to }))]);
    }
  }, [commands, pending]);

  useEffect(() => {
    if (said === null) return;
    const timer = window.setTimeout(() => setSaid(null), SAY_MS);
    return () => window.clearTimeout(timer);
  }, [said]);

  // Each flight lasts its time, then the counter pops and the coins go.
  useEffect(() => {
    if (flights.length === 0) return;
    const timers = flights.map((flight) =>
      window.setTimeout(() => {
        popCounter();
        setFlights((current) => current.filter((f) => f.id !== flight.id));
      }, FLIGHT_MS + COINS_PER_REWARD * COIN_DELAY_MS),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [flights]);

  const collect = (bubble: RewardBubble) => {
    if (pending.some((entry) => entry.goal === bubble.goal)) return;
    const requestId = session.command({ type: 'collect', goal: bubble.goal });
    if (requestId === null) {
      setSaid(NOT_SENT_WORDS);
      return;
    }
    setPending((current) => [...current, { requestId, goal: bubble.goal, from: spots.current.get(bubble.key) ?? { x: 0, y: 0 } }]);
  };

  const tap = (bubble: Bubble) => {
    if (bubble.kind === 'reward') collect(bubble);
    else store.getState().setView({ tappedBuilding: bubble.buildingId });
  };

  if (island === null) return null;
  return (
    <div className="bubble-layer" ref={root} data-detail={detail}>
      {shown.map((bubble) => (
        <button
          key={bubble.key}
          ref={(element) => {
            if (element === null) {
              nodes.current.delete(bubble.key);
              spots.current.delete(bubble.key);
            } else nodes.current.set(bubble.key, element);
          }}
          className="bubble"
          type="button"
          data-kind={bubble.kind}
          data-detail={detail}
          aria-label={bubble.label}
          aria-busy={bubble.kind === 'reward' && pending.some((entry) => entry.goal === bubble.goal) ? true : undefined}
          onClick={() => tap(bubble)}
        >
          <span className="bubble-body">
            {detail === 'dots' ? null : pictureOf(bubble.picture)}
            {detail === 'full' && bubble.kind === 'problem' && <i className="bubble-badge" />}
            {detail === 'full' && bubble.kind === 'reward' && <i className="bubble-sparkle" />}
          </span>
          {detail === 'full' && (bubble.kind === 'wish' ? <span className="bubble-trail" /> : <span className="bubble-tail" />)}
        </button>
      ))}
      {flights.map((flight) => (
        <span key={flight.id} className="coin-flight-group" aria-hidden="true">
          {Array.from({ length: COINS_PER_REWARD }, (_, index) => (
            <span
              key={index}
              className="coin-flight"
              data-coin-flight=""
              style={
                {
                  left: flight.from.x,
                  top: flight.from.y,
                  '--dx': `${flight.to.x - flight.from.x}px`,
                  '--dy': `${flight.to.y - flight.from.y}px`,
                  '--delay': `${index * COIN_DELAY_MS}ms`,
                  '--time': `${FLIGHT_MS}ms`,
                } as CSSProperties
              }
            >
              <span className="coin-flight-y">
                <Icon name="coin" size={22} />
              </span>
            </span>
          ))}
        </span>
      ))}
      {said !== null && (
        <p className="bubble-say" role="status">
          {said}
        </p>
      )}
    </div>
  );
}
