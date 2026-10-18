import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useFrameLoop } from './frameLoop.ts';

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => setHidden(false));

describe('the frame loop', () => {
  it('runs while the page is visible', () => {
    const { result } = renderHook(() => useFrameLoop());
    expect(result.current).toBe('always');
  });

  it('draws nothing while the page is hidden, and starts again when it comes back', () => {
    const { result } = renderHook(() => useFrameLoop());
    act(() => setHidden(true));
    expect(result.current).toBe('never');
    act(() => setHidden(false));
    expect(result.current).toBe('always');
  });

  it('starts as never when the page opens in the background', () => {
    setHidden(true);
    const { result } = renderHook(() => useFrameLoop());
    expect(result.current).toBe('never');
  });
});
