import { emit } from '../events.ts';
import { credit, pay } from '../ledger.ts';
import { residentsOf } from '../people.ts';
import type { IslandState } from '../state.ts';
import { goodsHeld } from '../stock.ts';
import { unloadCargo } from './cargo.ts';
import type { TickContext } from './context.ts';
import { moveInNewcomers, moveOutUnhappy } from './migration.ts';

// The commuter ferry (spec 2.2, 4.4, 12.1): a timetable with seats, not a simulated boat. The morning trip lands at
// the start of the day shift with newcomers, who board first, and the hired commuters in the seats left. The evening
// trip takes the commuters home and unhappy residents away in the seats left, and brings newcomers on its way in.
// Both trips carry bought goods in the cargo hold.

export function runFerry(ctx: TickContext, island: IslandState): void {
  const rules = ctx.content.rules;
  if (ctx.minute === rules.shiftStartMinute) {
    giveMainlandHelp(ctx, island);
    const newcomers = moveInNewcomers(ctx, island, rules.ferrySeats);
    boardCommuters(ctx, island, rules.ferrySeats - newcomers);
    unloadCargo(ctx, island);
  } else if (ctx.minute === rules.shiftEndMinute) {
    const goingHome = island.commuters.present;
    island.commuters.present = 0;
    moveOutUnhappy(ctx, island, rules.ferrySeats - goingHome);
    moveInNewcomers(ctx, island, rules.ferrySeats);
    unloadCargo(ctx, island);
  }
}

/**
 * The hired commuters board in the morning, as many as there are seats and as the island can pay a day's wage for
 * (paid as they board). Running costs never push money below zero: when short, fewer come (spec 12.1).
 */
function boardCommuters(ctx: TickContext, island: IslandState, seats: number): void {
  const wage = ctx.content.rules.commuterWagePerDayCents;
  const hired = island.commuters.hired;
  const bySeats = Math.min(hired, seats);
  const affordable = wage === 0 ? bySeats : Math.floor(island.coinsCents / wage);
  const coming = Math.min(bySeats, affordable);
  if (coming > 0) pay(island, coming * wage, 'wages', ctx.ledger);
  island.commuters.present = coming;
  if (coming < hired) {
    emit(ctx.sink, 'commuters-stayed-home', island.slot, {
      count: hired - coming,
      short: affordable < bySeats ? 'money' : 'seats',
    });
  }
}

/**
 * An island that spent every coin before it had residents or anything to sell cannot pay commuters, so it could never
 * start again: the Mainland credits a small grant on the morning ferry, before commuters board (spec 12.1). Stuck is
 * exact: no residents, coins below one commuter's day wage, no goods in any building, on the roads or in the cargo
 * hold, and no reward waiting to be collected. Checked only on the morning ferry, so at most once a day.
 */
function giveMainlandHelp(ctx: TickContext, island: IslandState): void {
  const rules = ctx.content.rules;
  if (residentsOf(island) > 0) return;
  if (island.coinsCents >= rules.commuterWagePerDayCents) return;
  if (island.rewards.length > 0) return;
  for (const good of ctx.content.goods) if (goodsHeld(island, good.id) > 0) return;
  credit(island, rules.mainlandHelpCents, 'mainland-help', ctx.ledger);
  emit(ctx.sink, 'mainland-help', island.slot, { cents: rules.mainlandHelpCents, hired: island.commuters.hired });
}
