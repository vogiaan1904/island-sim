import { Icon } from './icons.tsx';
import './Stepper.css';
import { countText } from './coins.ts';

/**
 * A number with a minus and a plus beside it: the way the player picks a small count (island-ui: big touch targets,
 * no typing). `label` names the group; the buttons read "<fewer> <noun>" and "<more> <noun>".
 */
export function Stepper({
  value,
  min,
  max,
  step = 1,
  label,
  fewer,
  more,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  /** The accessible name of the minus button. */
  fewer: string;
  /** The accessible name of the plus button. */
  more: string;
  onChange(value: number): void;
}) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button className="stepper-button" type="button" aria-label={fewer} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>
        <Icon name="minus" size={20} strokeWidth={3} />
      </button>
      <span className="stepper-value">{countText(value)}</span>
      <button className="stepper-button" type="button" aria-label={more} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>
        <Icon name="plus" size={20} strokeWidth={3} />
      </button>
    </div>
  );
}
