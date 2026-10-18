import { content, type GoodId } from '@island/content';
import type { KeyStaffState } from '@island/sim';
import { useState } from 'react';
import { useGameState } from '../../session/game.tsx';
import { Icon } from '../icons.tsx';
import { GOOD_NAMES, goodPicture, portraitPicture, PORT_MASTER_TRAITS, ROLE_NAMES } from '../names.ts';
import { Stepper } from '../Stepper.tsx';
import { useCommand } from '../useCommand.ts';
import './StaffPanel.css';

/** How much a rule keeps when the player first turns it on, and the step of its stepper. */
const FIRST_KEEP = 10;
const KEEP_STEP = 5;

/**
 * The Staff panel (island-ui, screens.md section 9): two clear choices with pictures, one under the other. The first
 * hires Mainland commuters, limited by the ferry's seats; the second introduces the port master and the auto-sell
 * rule they run. A visitor sees neither: hiring and the rules are the owner's.
 */
export function StaffPanel() {
  const own = useGameState((state) => state.island?.own ?? false);
  const staff = useGameState((state) => state.island?.state.staff);
  if (!own) {
    return <p className="staff-note">Hiring and the port master's rules belong to the island's owner.</p>;
  }
  const portMaster = staff?.find((member) => member.role === 'port-master');
  return (
    <div className="staff">
      <Commuters />
      {portMaster !== undefined && <PortMaster member={portMaster} />}
    </div>
  );
}

function Commuters() {
  const hiredNow = useGameState((state) => state.island?.state.commuters.hired ?? 0);
  const present = useGameState((state) => state.island?.state.commuters.present ?? 0);
  const [choice, setChoice] = useState(hiredNow);
  const { send, outcome } = useCommand();
  const seats = content.rules.ferrySeats;
  const wage = Math.floor(content.rules.commuterWagePerDayCents / 100);
  return (
    <section className="staff-card" aria-labelledby="staff-commuters">
      <div className="staff-head">
        <span className="staff-picture" aria-hidden="true">
          <Icon name="users" size={34} />
        </span>
        <div>
          <h3 id="staff-commuters" className="staff-title">
            Mainland commuters
          </h3>
          <p className="staff-line">Workers who come on the morning ferry and go home in the evening. Each earns {wage} coins a day.</p>
        </div>
      </div>
      <p className="staff-line staff-seats">
        <Icon name="anchor" size={18} /> The ferry has {seats} seats. Newcomers board first, so on a busy morning fewer commuters come.
      </p>
      <div className="staff-row">
        <Stepper
          value={choice}
          min={0}
          max={seats}
          label="Commuters to hire"
          fewer="Fewer commuters"
          more="More commuters"
          onChange={setChoice}
        />
        <button className="staff-go" type="button" disabled={choice === hiredNow || outcome.status === 'pending'} onClick={() => send({ type: 'hire-commuters', count: choice })}>
          Hire
        </button>
      </div>
      {hiredNow > 0 && (
        <p className="staff-line">
          {hiredNow} hired, {present} here today
        </p>
      )}
      {outcome.status === 'refused' && (
        <p className="staff-refusal" role="alert">
          {outcome.words}
        </p>
      )}
    </section>
  );
}

function PortMaster({ member }: { member: KeyStaffState }) {
  const trait = PORT_MASTER_TRAITS[member.name];
  const autoSell = useGameState((state) => state.island?.state.autoSell);
  const { send, outcome } = useCommand();
  return (
    <section className="staff-card" role="group" aria-label={`${ROLE_NAMES[member.role]} ${member.name}`}>
      <div className="staff-head">
        <img className="staff-portrait" src={portraitPicture(member.name)} alt={member.name} width={72} height={72} draggable={false} />
        <div>
          <p className="staff-tag">
            <span>{member.name}</span> <span aria-hidden="true">&middot;</span> <span>{ROLE_NAMES[member.role]}</span>
          </p>
          {trait !== undefined && (
            <p className="staff-line" data-testid="trait">
              {trait}
            </p>
          )}
        </div>
      </div>
      <p className="staff-line">Sells your surplus to the Mainland while you are away, and keeps what you ask them to keep.</p>
      <ul className="staff-rules">
        {content.goods.map(({ id }) => (
          <Rule key={id} good={id} name={member.name} keep={autoSell?.[id]} send={send} />
        ))}
      </ul>
      {outcome.status === 'refused' && (
        <p className="staff-refusal" role="alert">
          {outcome.words}
        </p>
      )}
    </section>
  );
}

function Rule({ good, name, keep, send }: { good: GoodId; name: string; keep: number | undefined; send: ReturnType<typeof useCommand>['send'] }) {
  const on = keep !== undefined;
  const goodName = GOOD_NAMES[good];
  return (
    <li className="staff-rule">
      <div className="staff-rule-main">
        <span className="staff-good">
          <img src={goodPicture(good)} alt="" width={36} height={36} draggable={false} />
        </span>
        <span className="staff-rule-name">{goodName}</span>
        <button
          className="staff-switch"
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={`Sell surplus ${goodName.toLowerCase()}`}
          onClick={() => send({ type: 'set-auto-sell', good, keep: on ? null : FIRST_KEEP })}
        >
          <span className="staff-switch-knob" />
        </button>
      </div>
      {on && (
        <div className="staff-rule-keep">
          <p className="staff-line">
            {name} sells {goodName.toLowerCase()} above {keep} once the Mainland pays a fair price
          </p>
          <Stepper
            value={keep}
            min={0}
            max={999}
            step={KEEP_STEP}
            label={`Keep ${goodName.toLowerCase()}`}
            fewer={`Keep less ${goodName.toLowerCase()}`}
            more={`Keep more ${goodName.toLowerCase()}`}
            onChange={(value) => send({ type: 'set-auto-sell', good, keep: value })}
          />
        </div>
      )}
    </li>
  );
}
