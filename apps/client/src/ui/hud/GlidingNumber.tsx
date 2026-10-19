import { useLayoutEffect, useRef } from 'react';
import { countText } from '../coins.ts';
import { createCounterGlide, type CounterGlide } from '../../glide/counter.ts';

const reducedMotion = (): boolean => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A whole number that glides to each new value over one tick (see `glide/counter.ts`) and never flickers. The digits
 * are written straight onto the element by a frame loop that stops once the number has arrived, so a counter does not
 * re-render React per frame. `resetKey` changes when the number belongs to another island: it jumps instead of gliding.
 */
export function GlidingNumber({ value, resetKey }: { value: number; resetKey: string }) {
  const element = useRef<HTMLSpanElement>(null);
  const glide = useRef<CounterGlide | null>(null);
  const key = useRef<string | null>(null);
  const frame = useRef(0);

  useLayoutEffect(() => {
    const show = (shown: number) => {
      if (element.current !== null) element.current.textContent = countText(Math.round(shown));
    };
    const counter = (glide.current ??= createCounterGlide());
    const now = performance.now();
    if (key.current !== resetKey || reducedMotion()) {
      counter.reset(value, now);
      key.current = resetKey;
    } else {
      counter.set(value, now);
    }
    const run = () => {
      const at = performance.now();
      show(counter.valueAt(at));
      frame.current = counter.movingAt(at) ? requestAnimationFrame(run) : 0;
    };
    cancelAnimationFrame(frame.current);
    run();
    return () => cancelAnimationFrame(frame.current);
  }, [value, resetKey]);

  return <span ref={element} className="hud-number" />;
}
