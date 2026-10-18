import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../App.tsx';
import { expectNoEmoji } from '../test/no-emoji.ts';
import { LoadingScreen } from './LoadingScreen.tsx';

describe('the loading page', () => {
  it('tells the player in words that the island is getting ready, as a calm status', () => {
    render(<LoadingScreen />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Getting your island ready');
    expect(screen.getByRole('heading', { level: 1, name: 'Island Sim' })).toBeInTheDocument();
  });

  it('shows a picture of the island instead of a bare spinner, with a description for screen readers', () => {
    render(<LoadingScreen />);
    const picture = screen.getByRole('img', { name: /island hall/i });
    expect(picture).toHaveAttribute('src', '/icons/building_island-hall_a.png');
  });

  it('has no emoji or emoji-like symbol in anything the player sees or hears', () => {
    const { container } = render(<LoadingScreen />);
    expectNoEmoji(container);
  });

  it('is the first screen of the app', () => {
    const { container } = render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent('Getting your island ready');
    expectNoEmoji(container);
  });
});
