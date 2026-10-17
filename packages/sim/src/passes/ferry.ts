import { emit } from '../events.ts';
import { pay } from '../ledger.ts';
import type { IslandState } from '../state.ts';
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
