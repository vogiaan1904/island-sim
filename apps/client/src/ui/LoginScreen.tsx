import { useState, type FormEvent } from 'react';
import type { ClientApiReason } from '../connection/api.ts';
import { apiReasonText } from './apiReasons.ts';
import './LoginScreen.css';

export interface LoginScreenProps {
  /** Null when the log-in worked (the island then opens), else why it was refused. */
  onLogIn(username: string, password: string): Promise<ClientApiReason | null>;
  /** The player has a friend's invite code and wants an account. */
  onSignUp(): void;
}

/** The log-in screen (style A): username and password, and the way to sign up with an invite code. */
export function LoginScreen({ onLogIn, onSignUp }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const reason = await onLogIn(username, password);
    setBusy(false);
    if (reason !== null) setError(apiReasonText(reason));
  };

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={(event) => void submit(event)}>
        <img className="login-picture" src="/icons/building_dock_a.png" alt="" width="256" height="256" />
        <h1 className="login-title">Island Sim</h1>
        <label className="login-field">
          <span>Username</span>
          <input
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label className="login-field">
          <span>Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error !== null && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        <button className="login-button" type="submit" disabled={busy}>
          {busy ? 'Logging in' : 'Log in'}
        </button>
        <button className="login-link" type="button" onClick={onSignUp}>
          I have an invite code
        </button>
      </form>
    </main>
  );
}
