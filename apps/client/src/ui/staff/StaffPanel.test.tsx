import type { PlayerCommand } from '@island/protocol';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { GameProvider, type Game } from '../../session/game.tsx';
import { stubGame } from '../../test/game.ts';
import { aliceWorld, islandMessage, islandOf } from '../../test/islands.ts';
import { expectNoEmoji } from '../../test/no-emoji.ts';
import { StaffPanel } from './StaffPanel.tsx';

interface Setup {
  autoSell?: Record<string, number>;
  hired?: number;
  own?: boolean;
}

/** The staff panel on Alice's island, with the port master Lena; every command sent is kept, with a request id. */
function show({ autoSell = {}, hired = 0, own = true }: Setup = {}) {
  const world = aliceWorld();
  const island = islandOf(world);
  island.staff = [{ id: 900, role: 'port-master', name: 'Lena', look: 3 }];
  island.autoSell = autoSell;
  island.commuters = { hired, present: Math.min(hired, 4) };
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
      <StaffPanel />
    </GameProvider>,
  );
  return { game, sent, ...view };
}

function refuse(game: Game, requestId: number, reason: 'not-enough-seats' | 'rate-limited') {
  act(() => game.store.getState().receive({ type: 'result', requestId, ok: false, reason, shortfallCents: 0 }));
}

describe('the Staff panel: hiring commuters', () => {
  it('says how many seats the ferry has and that newcomers board first', () => {
    show();
    expect(screen.getByText(/The ferry has 12 seats/)).toBeInTheDocument();
    expect(screen.getByText(/newcomers board first/i)).toBeInTheDocument();
  });

  it('starts from the number already hired and shows who is here today', () => {
    show({ hired: 6 });
    expect(screen.getByRole('group', { name: 'Commuters to hire' })).toHaveTextContent('6');
    expect(screen.getByText('6 hired, 4 here today')).toBeInTheDocument();
  });

  it('sends hire-commuters with the chosen number', async () => {
    const user = userEvent.setup();
    const { sent } = show();
    const more = screen.getByRole('button', { name: 'More commuters' });
    await user.click(more);
    await user.click(more);
    await user.click(more);
    await user.click(screen.getByRole('button', { name: 'Hire' }));
    expect(sent).toEqual([{ type: 'hire-commuters', count: 3 }]);
  });

  it('keeps the choice within the ferry seats and never below none', async () => {
    const user = userEvent.setup();
    show({ hired: 11 });
    const more = screen.getByRole('button', { name: 'More commuters' });
    await user.click(more);
    expect(screen.getByRole('group', { name: 'Commuters to hire' })).toHaveTextContent('12');
    expect(more).toBeDisabled();
    const fewer = screen.getByRole('button', { name: 'Fewer commuters' });
    for (let i = 0; i < 13; i++) await user.click(fewer);
    expect(screen.getByRole('group', { name: 'Commuters to hire' })).toHaveTextContent('0');
    expect(fewer).toBeDisabled();
  });

  it('has nothing to send while the choice is the number already hired', () => {
    show({ hired: 3 });
    expect(screen.getByRole('button', { name: 'Hire' })).toBeDisabled();
  });

  it('says in words when the ferry refuses', async () => {
    const user = userEvent.setup();
    const { game } = show();
    await user.click(screen.getByRole('button', { name: 'More commuters' }));
    await user.click(screen.getByRole('button', { name: 'Hire' }));
    refuse(game, 1, 'not-enough-seats');
    expect(screen.getByRole('alert')).toHaveTextContent("The ferry doesn't have that many seats");
  });
});

describe('the Staff panel: the port master', () => {
  it('introduces the port master with portrait, name, role and trait', () => {
    show();
    const card = screen.getByRole('group', { name: 'Port master Lena' });
    expect(within(card).getByRole('img', { name: 'Lena' })).toHaveAttribute('src', '/icons/portrait_lena_a.png');
    expect(within(card).getByText('Lena')).toBeInTheDocument();
    expect(within(card).getByText('Port master')).toBeInTheDocument();
    expect(within(card).getByTestId('trait')).not.toBeEmptyDOMElement();
  });

  it('turns the auto-sell rule on for a good and sends it with a keep amount', async () => {
    const user = userEvent.setup();
    const { sent } = show();
    const fish = screen.getByRole('switch', { name: 'Sell surplus fish' });
    expect(fish).toHaveAttribute('aria-checked', 'false');
    await user.click(fish);
    expect(sent).toEqual([{ type: 'set-auto-sell', good: 'fish', keep: 10 }]);
  });

  it('shows a rule that is on as one plain sentence, and turns it off with a null keep', async () => {
    const user = userEvent.setup();
    const { sent } = show({ autoSell: { fish: 20 } });
    const fish = screen.getByRole('switch', { name: 'Sell surplus fish' });
    expect(fish).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Lena sells fish above 20 once the Mainland pays a fair price')).toBeInTheDocument();
    await user.click(fish);
    expect(sent).toEqual([{ type: 'set-auto-sell', good: 'fish', keep: null }]);
  });

  it('changes how much to keep in steps of five', async () => {
    const user = userEvent.setup();
    const { sent } = show({ autoSell: { wood: 20 } });
    await user.click(screen.getByRole('button', { name: 'Keep more wood' }));
    await user.click(screen.getByRole('button', { name: 'Keep less wood' }));
    expect(sent).toEqual([
      { type: 'set-auto-sell', good: 'wood', keep: 25 },
      { type: 'set-auto-sell', good: 'wood', keep: 15 },
    ]);
  });

  it('offers a stepper only for goods whose rule is on', () => {
    show({ autoSell: { wood: 20 } });
    expect(screen.queryByRole('button', { name: 'Keep more fish' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep more wood' })).toBeInTheDocument();
  });
});

describe('the Staff panel: states', () => {
  it('hides every owner control on a visit', () => {
    show({ own: false });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.getByText(/belong to the island's owner/i)).toBeInTheDocument();
  });

  it('draws no emoji or emoji-like symbols', () => {
    const { container } = show({ autoSell: { fish: 20 }, hired: 3 });
    expectNoEmoji(container);
  });
});
