import { useState, type FormEvent } from 'react';
import type { RegisterRequest } from '@island/protocol';
import type { ClientApiReason } from '../connection/api.ts';
import { apiReasonText } from './apiReasons.ts';
import { Field } from './Field.tsx';
import { RULE_TEXT, checkInviteCode, checkIslandName, checkPassword, checkUsername } from './fieldRules.ts';
import './forms.css';

export interface SignUpScreenProps {
  /** Null when the sign-up worked (the island then opens), else why it was refused. */
  onSignUp(request: RegisterRequest): Promise<ClientApiReason | null>;
  onBack(): void;
}

interface Problems {
  username: string | null;
  password: string | null;
  inviteCode: string | null;
  islandName: string | null;
}

const NO_PROBLEMS: Problems = { username: null, password: null, inviteCode: null, islandName: null };

/** Sign-up with a friend's invite code: it makes the account and claims an island in that world (style A). */
export function SignUpScreen({ onSignUp, onBack }: SignUpScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [islandName, setIslandName] = useState('');
  const [problems, setProblems] = useState<Problems>(NO_PROBLEMS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const found: Problems = {
      username: checkUsername(username),
      password: checkPassword(password),
      inviteCode: checkInviteCode(inviteCode),
      islandName: checkIslandName(islandName),
    };
    setProblems(found);
    setError(null);
    if (Object.values(found).some((problem) => problem !== null)) return;
    setBusy(true);
    const reason = await onSignUp({ username, password, inviteCode, islandName });
    setBusy(false);
    if (reason !== null) setError(apiReasonText(reason));
  };

  const edit = (field: keyof Problems, set: (text: string) => void) => (text: string) => {
    set(text);
    setProblems((now) => (now[field] === null ? now : { ...now, [field]: null }));
  };

  return (
    <main className="form-screen">
      <form className="form-card" noValidate onSubmit={(event) => void submit(event)}>
        <img className="form-picture" src="/icons/building_island-hall_a.png" alt="" width="256" height="256" />
        <h1 className="form-title">Join a friend's world</h1>
        <Field
          id="signup-username"
          label="Username"
          hint={RULE_TEXT.username}
          error={problems.username}
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          onChange={(event) => edit('username', setUsername)(event.target.value)}
        />
        <Field
          id="signup-password"
          label="Password"
          hint={RULE_TEXT.password}
          error={problems.password}
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => edit('password', setPassword)(event.target.value)}
        />
        <Field
          id="signup-invite-code"
          label="Invite code"
          hint={RULE_TEXT.inviteCode}
          error={problems.inviteCode}
          name="inviteCode"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={inviteCode}
          onChange={(event) => edit('inviteCode', setInviteCode)(event.target.value)}
        />
        <Field
          id="signup-island-name"
          label="Island name"
          hint={RULE_TEXT.islandName}
          error={problems.islandName}
          name="islandName"
          autoComplete="off"
          value={islandName}
          onChange={(event) => edit('islandName', setIslandName)(event.target.value)}
        />
        {error !== null && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="form-button" type="submit" disabled={busy}>
          {busy ? 'Signing up' : 'Sign up'}
        </button>
        <button className="form-link" type="button" onClick={onBack}>
          I already have an account
        </button>
      </form>
    </main>
  );
}
