import { content } from '@island/content';
import type { PlayerCommand } from '@island/protocol';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { GameProvider, type Game } from '../../session/game.tsx';
import { stubGame } from '../../test/game.ts';
import { aliceWorld, islandMessage, islandOf } from '../../test/islands.ts';
import { expectNoEmoji } from '../../test/no-emoji.ts';
import { TradePanel } from './TradePanel.tsx';

interface Setup {
  fish?: number;
  wood?: number;
  prices?: Partial<Record<'wood' | 'fish' | 'vegetables', number>>;
  own?: boolean;
}

/** The trade panel on Alice's island: goods in the dock, the Mainland's prices; every command sent is kept. */
function show({ fish = 8, wood = 0, prices = {}, own = true }: Setup = {}) {
  const world = aliceWorld();
  const dock = islandOf(world).buildings.find((b) => b.type === 'dock');
  if (dock === undefined) throw new Error('no dock');
  dock.stock = { fish, wood };
  Object.assign(world.market.prices, prices);
  const game = stubGame('playing');
  game.store.getState().receive({ ...islandMessage(world), own });
  const sent: PlayerCommand[] = [];
  let nextId = 1;
  game.session.command = (command) => {
    const id = nextId++;
    sent.push(command);
    game.store.getState().commandSent(id, command);
    return id;
  };
  const view = render(
    <GameProvider game={game}>
      <TradePanel />
    </GameProvider>,
  );
  return { game, sent, ...view };
}

const tile = (good: string) => screen.getByRole('group', { name: good });

function settle(game: Game, requestId: number, result: { ok: true; data: Record<string, number> } | { ok: false; reason: 'price-below-floor' }) {
  act(() =>
    game.store.getState().receive(
      result.ok
        ? { type: 'result', requestId, ok: true, data: result.data }
        : { type: 'result', requestId, ok: false, reason: result.reason, shortfallCents: 0 },
    ),
  );
}

describe('the Trade panel: goods as picture tiles', () => {
  it('shows one tile per good with its picture, the Mainland price in coins and what is in storage', () => {
    show({ fish: 8, prices: { fish: 550 } });
    const fish = tile('Fish');
    expect(fish.querySelector('img')).toHaveAttribute('src', '/icons/good_fish_a.png');
    expect(within(fish).getByText('5')).toBeInTheDocument();
    expect(within(fish).getByText('8 in storage')).toBeInTheDocument();
    expect(screen.getAllByRole('group').length).toBe(content.goods.length);
  });

  it('shows a trend as an icon with words, never a chart', () => {
    const base = (id: string) => content.goods.find((g) => g.id === id)?.basePriceCents ?? 0;
    show({ prices: { fish: base('fish') * 2, wood: Math.floor(base('wood') / 2) } });
    expect(within(tile('Fish')).getByLabelText('Above the usual price')).toBeInTheDocument();
    expect(within(tile('Wood')).getByLabelText('Below the usual price')).toBeInTheDocument();
    expect(within(tile('Vegetables')).queryByLabelText(/the usual price/)).not.toBeInTheDocument();
  });
});

describe('the Trade panel: selling', () => {
  it('sells one, or everything in storage, with the sell command', async () => {
    const user = userEvent.setup();
    const { game, sent } = show({ fish: 8 });
    await user.click(within(tile('Fish')).getByRole('button', { name: 'Sell 1 fish' }));
    settle(game, 1, { ok: true, data: { amount: 1, priceCents: 500, earnedCents: 500 } });
    await user.click(within(tile('Fish')).getByRole('button', { name: 'Sell all fish' }));
    expect(sent).toEqual([
      { type: 'sell', good: 'fish', amount: 1 },
      { type: 'sell', good: 'fish', amount: 8 },
    ]);
  });

  it('has nothing to sell when the stores hold none of a good', () => {
    show({ wood: 0 });
    expect(within(tile('Wood')).getByRole('button', { name: 'Sell 1 wood' })).toBeDisabled();
    expect(within(tile('Wood')).getByRole('button', { name: 'Sell all wood' })).toBeDisabled();
    expect(within(tile('Wood')).getByText('Nothing in storage')).toBeInTheDocument();
  });

  it('says what a sale earned', async () => {
    const user = userEvent.setup();
    const { game } = show({ fish: 8 });
    await user.click(within(tile('Fish')).getByRole('button', { name: 'Sell all fish' }));
    settle(game, 1, { ok: true, data: { amount: 8, priceCents: 500, earnedCents: 4000 } });
    expect(within(tile('Fish')).getByRole('status')).toHaveTextContent('Sold 8 for 40 coins');
  });

  it('says plainly when the floor price stops a sale', async () => {
    const user = userEvent.setup();
    const floor = content.goods.find((g) => g.id === 'fish')?.floorPriceCents ?? 0;
    const { game } = show({ fish: 8, prices: { fish: floor - 1 } });
    expect(within(tile('Fish')).getByText('Paying too little')).toBeInTheDocument();
    await user.click(within(tile('Fish')).getByRole('button', { name: 'Sell all fish' }));
    settle(game, 1, { ok: false, reason: 'price-below-floor' });
    expect(within(tile('Fish')).getByRole('alert')).toHaveTextContent('The Mainland pays too little right now');
  });

  it('does not call a price at the floor too little', () => {
    const floor = content.goods.find((g) => g.id === 'fish')?.floorPriceCents ?? 0;
    show({ prices: { fish: floor } });
    expect(within(tile('Fish')).queryByText('Paying too little')).not.toBeInTheDocument();
  });

  it('says so when a command could not be sent at all', async () => {
    const user = userEvent.setup();
    const { game } = show({ fish: 8 });
    game.session.command = () => null;
    await user.click(within(tile('Fish')).getByRole('button', { name: 'Sell 1 fish' }));
    expect(within(tile('Fish')).getByRole('alert')).toHaveTextContent("That can't be done just now");
  });
});

describe('the Trade panel: states', () => {
  it('hides selling on a visit', () => {
    show({ own: false });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/belongs to the island's owner/i)).toBeInTheDocument();
  });

  it('draws no emoji or emoji-like symbols', () => {
    const { container } = show({ fish: 8, prices: { fish: 100 } });
    expectNoEmoji(container);
  });
});
