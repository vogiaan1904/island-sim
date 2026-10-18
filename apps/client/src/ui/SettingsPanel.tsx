import { useState, type FormEvent } from 'react';
import type { ClientApiReason } from '../connection/api.ts';
import { QUALITIES, type Quality } from '../render/quality.ts';
import { useGame, useGameState } from '../session/game.tsx';
import { deviceStorage, saveSettings, type SettingsStorage } from '../store/settings.ts';
import type { ViewState } from '../store/view.ts';
import { apiReasonText } from './apiReasons.ts';
import { Field } from './Field.tsx';
import { checkPassword } from './fieldRules.ts';
import './forms.css';
import './SettingsPanel.css';

const QUALITY_LABEL: Record<Quality, string> = { low: 'Low', medium: 'Medium', high: 'High' };
const CONTROLS: ReadonlyArray<{ value: ViewState['controlsChoice']; label: string }> = [
  { value: 'auto', label: 'Automatic' },
  { value: 'trackpad', label: 'Trackpad' },
  { value: 'mouse', label: 'Mouse' },
];

/** What the panel says when the server refuses a password change; the current password is the usual cause. */
function passwordReasonText(reason: ClientApiReason): string {
  return reason === 'bad-credentials' ? "That isn't your current password. Check it and try again." : apiReasonText(reason);
}

/**
 * Settings, from the gear: sound, quality, controls, the account and log out. Plain words and big choices, no nested
 * menus. Sound, quality and controls are remembered on this device (`store/settings.ts`); a quality the player picks
 * here is theirs for good, the start check never changes it.
 */
export function SettingsPanel({ storage = deviceStorage() }: { storage?: SettingsStorage | null }) {
  const { store } = useGame();
  const muted = useGameState((state) => state.view.muted);
  const quality = useGameState((state) => state.view.quality);
  const controls = useGameState((state) => state.view.controlsChoice);

  return (
    <div className="settings">
      <section className="settings-block">
        <h3 className="settings-heading">Sound</h3>
        <button
          className="settings-toggle"
          type="button"
          role="switch"
          aria-checked={!muted}
          aria-label="Sound"
          onClick={() => {
            store.getState().setView({ muted: !muted });
            saveSettings(storage, { muted: !muted });
          }}
        >
          <span>{muted ? 'Off' : 'On'}</span>
          <span className="settings-knob" aria-hidden="true" />
        </button>
      </section>

      <section className="settings-block">
        <h3 className="settings-heading" id="settings-quality">
          Quality
        </h3>
        <div className="settings-choices" role="radiogroup" aria-labelledby="settings-quality">
          {QUALITIES.map((tier) => (
            <button
              key={tier}
              className="settings-choice"
              type="button"
              role="radio"
              aria-checked={quality === tier}
              onClick={() => {
                store.getState().setView({ quality: tier, qualityChosen: true });
                saveSettings(storage, { quality: tier });
              }}
            >
              {QUALITY_LABEL[tier]}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-block">
        <h3 className="settings-heading" id="settings-controls">
          Controls
        </h3>
        <div className="settings-choices" role="radiogroup" aria-labelledby="settings-controls">
          {CONTROLS.map(({ value, label }) => (
            <button
              key={value}
              className="settings-choice"
              type="button"
              role="radio"
              aria-checked={controls === value}
              onClick={() => {
                store.getState().setView({ controlsChoice: value });
                saveSettings(storage, { controls: value });
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <AccountBlock />
    </div>
  );
}

/** Who is signed in, change password, the way to the world screen and log out. */
function AccountBlock() {
  const { store, session } = useGame();
  const username = useGameState((state) => state.session.account?.username ?? '');
  const [loggingOut, setLoggingOut] = useState(false);
  const [logOutError, setLogOutError] = useState<string | null>(null);

  const close = () => store.getState().setView({ openPanel: null });

  const logOut = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogOutError(null);
    const reason = await session.logOut();
    setLoggingOut(false);
    if (reason === null) close();
    else setLogOutError(apiReasonText(reason));
  };

  return (
    <section className="settings-block">
      <h3 className="settings-heading">Account</h3>
      <p className="settings-line">
        Signed in as <strong>{username}</strong>
      </p>
      <PasswordForm />
      <div className="settings-actions">
        <button
          className="form-small-button"
          type="button"
          onClick={() => {
            close();
            void session.showWorlds();
          }}
        >
          My worlds
        </button>
        <button className="form-small-button" type="button" disabled={loggingOut} onClick={() => void logOut()}>
          Log out
        </button>
      </div>
      <p className="form-hint">Log out only ends this device. Your other devices stay signed in.</p>
      {logOutError !== null && (
        <p className="form-error" role="alert">
          {logOutError}
        </p>
      )}
    </section>
  );
}

function PasswordForm() {
  const { session } = useGame();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [nextError, setNextError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setDone(false);
    setFailure(null);
    const missing = current === '' ? 'Type your current password first.' : null;
    const weak = checkPassword(next);
    setCurrentError(missing);
    setNextError(weak);
    if (missing !== null || weak !== null) return;
    setBusy(true);
    const reason = await session.changePassword(current, next);
    setBusy(false);
    if (reason !== null) {
      setFailure(passwordReasonText(reason));
      return;
    }
    setCurrent('');
    setNext('');
    setDone(true);
  };

  return (
    <form className="settings-password" onSubmit={(event) => void submit(event)} noValidate>
      <Field
        id="settings-current-password"
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={current}
        error={currentError}
        onChange={(event) => setCurrent(event.target.value)}
      />
      <Field
        id="settings-new-password"
        label="New password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters. Your other devices will be signed out."
        value={next}
        error={nextError}
        onChange={(event) => setNext(event.target.value)}
      />
      {failure !== null && (
        <p className="form-error" role="alert">
          {failure}
        </p>
      )}
      {done && (
        <p className="settings-done" role="status">
          Password changed. Your other devices were signed out.
        </p>
      )}
      <button className="form-button" type="submit" disabled={busy}>
        Change password
      </button>
    </form>
  );
}
