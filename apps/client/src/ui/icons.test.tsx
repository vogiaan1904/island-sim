import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoEmoji } from '../test/no-emoji.ts';
import { ICON_NAMES, Icon } from './icons.tsx';

describe('the UI icon set', () => {
  it('has the icons the HUD and the next panels need', () => {
    for (const name of ['hammer', 'staff', 'anchor', 'book', 'users', 'settings', 'coin', 'x', 'droplet', 'bread']) {
      expect(ICON_NAMES).toContain(name);
    }
  });

  it('draws every icon as an svg hidden from screen readers, with real shapes in it', () => {
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />);
      const svg = container.querySelector('svg');
      expect(svg, name).not.toBeNull();
      expect(svg?.getAttribute('aria-hidden'), name).toBe('true');
      expect(svg?.querySelectorAll('path, circle, rect').length, name).toBeGreaterThan(0);
      expectNoEmoji(container);
      unmount();
    }
  });

  it('draws line icons in the current text color on the 24 px grid, and the coin in its own colors', () => {
    const line = render(<Icon name="hammer" />).container.querySelector('svg');
    expect(line?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(line?.getAttribute('stroke')).toBe('currentColor');
    expect(line?.getAttribute('fill')).toBe('none');
    const coin = render(<Icon name="coin" />).container.querySelector('svg');
    expect(coin?.getAttribute('stroke')).toBeNull();
  });

  it('takes a size in CSS px', () => {
    const svg = render(<Icon name="users" size={30} />).container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('30');
    expect(svg?.getAttribute('height')).toBe('30');
  });
});
