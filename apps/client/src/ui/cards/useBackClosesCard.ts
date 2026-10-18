import { useEffect, useRef } from 'react';

/**
 * Android's back button closes the open card first (island-ui, layout-and-input.md). While a card is open the page holds
 * one extra history step; back removes it and closes the card. A card closed some other way gives the step back, so a
 * later back still leaves the page the way it would have.
 */
export function useBackClosesCard(open: boolean, close: () => void): void {
  const pushed = useRef(false);
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (open && !pushed.current) {
      window.history.pushState({ card: true }, '');
      pushed.current = true;
    } else if (!open && pushed.current) {
      pushed.current = false;
      window.history.back();
    }
  }, [open]);

  useEffect(() => {
    const onBack = () => {
      if (!pushed.current) return;
      pushed.current = false;
      closeRef.current();
    };
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, []);
}
