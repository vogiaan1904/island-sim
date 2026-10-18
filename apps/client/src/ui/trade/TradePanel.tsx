import { content, type GoodDef } from '@island/content';
import { storedForSale, type IslandState, type MarketState } from '@island/sim';
import { useMemo } from 'react';
import { useGameState } from '../../session/game.tsx';
import { Icon } from '../icons.tsx';
import { GOOD_NAMES, goodPicture } from '../names.ts';
import { useCommand } from '../useCommand.ts';
import './TradePanel.css';

/** A price this much above or below the good's usual price (in percent) shows as a trend; closer counts as usual. */
const TREND_PERCENT = 10;

export type Trend = 'above' | 'below' | 'usual';

export function trendOf(good: GoodDef, priceCents: number): Trend {
  if (priceCents * 100 >= good.basePriceCents * (100 + TREND_PERCENT)) return 'above';
  if (priceCents * 100 <= good.basePriceCents * (100 - TREND_PERCENT)) return 'below';
  return 'usual';
}

/**
 * The Trade panel (island-ui, screens.md section 9): the island's goods as picture tiles, each with the Mainland's
 * price, a trend as an icon, how much is in storage and the Sell buttons. A sale below the good's floor price is
 * refused by the sim; the tile says so up front and in words after a refusal, never silently. A visitor cannot trade.
 */
export function TradePanel() {
  const own = useGameState((state) => state.island?.own ?? false);
  const island = useGameState((state) => state.island?.state);
  const market = useGameState((state) => state.island?.entities.get('market') as MarketState | undefined);
  if (!own) return <p className="trade-note">Trading belongs to the island's owner.</p>;
  if (island === undefined || market === undefined) return null;
  return (
    <ul className="trade">
      {content.goods.map((good) => (
        <GoodTile key={good.id} good={good} island={island} priceCents={market.prices[good.id]} />
      ))}
    </ul>
  );
}

function GoodTile({ good, island, priceCents }: { good: GoodDef; island: IslandState; priceCents: number }) {
  const name = GOOD_NAMES[good.id];
  const lower = name.toLowerCase();
  const stored = useMemo(() => storedForSale(island, content, good.id), [island, good.id]);
  const trend = trendOf(good, priceCents);
  const tooLittle = priceCents < good.floorPriceCents;
  const { send, outcome } = useCommand();
  const sell = (amount: number) => send({ type: 'sell', good: good.id, amount });
  return (
    <li className="trade-tile" role="group" aria-label={name}>
      <div className="trade-top">
        <span className="trade-picture">
          <img src={goodPicture(good.id)} alt="" width={56} height={56} draggable={false} />
        </span>
        <div className="trade-info">
          <h3 className="trade-name">{name}</h3>
          <p className="trade-price">
            <Icon name="coin" size={20} />
            <span className="trade-price-number">{Math.floor(priceCents / 100)}</span>
            <span className="trade-each">each</span>
            {trend === 'above' && (
              <span className="trade-trend" data-trend="above" role="img" aria-label="Above the usual price">
                <Icon name="up" size={18} strokeWidth={3} />
              </span>
            )}
            {trend === 'below' && (
              <span className="trade-trend" data-trend="below" role="img" aria-label="Below the usual price">
                <Icon name="down" size={18} strokeWidth={3} />
              </span>
            )}
          </p>
          <p className="trade-stored">{stored > 0 ? `${stored.toLocaleString('en-US')} in storage` : 'Nothing in storage'}</p>
        </div>
      </div>
      {tooLittle && (
        <p className="trade-chip">
          <Icon name="alert" size={16} />
          <span>Paying too little</span>
        </p>
      )}
      <div className="trade-buttons">
        <button className="trade-sell" type="button" aria-label={`Sell 1 ${lower}`} disabled={stored < 1 || outcome.status === 'pending'} onClick={() => sell(1)}>
          Sell 1
        </button>
        <button className="trade-sell trade-sell-all" type="button" aria-label={`Sell all ${lower}`} disabled={stored < 1 || outcome.status === 'pending'} onClick={() => sell(stored)}>
          Sell all
        </button>
      </div>
      {outcome.status === 'ok' && (
        <p className="trade-result" role="status">
          Sold {outcome.data.amount ?? 0} for {Math.floor((outcome.data.earnedCents ?? 0) / 100)} coins
        </p>
      )}
      {outcome.status === 'refused' && (
        <p className="trade-refusal" role="alert">
          {outcome.words}
        </p>
      )}
    </li>
  );
}
