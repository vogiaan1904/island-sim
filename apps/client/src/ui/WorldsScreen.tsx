import { useState, type FormEvent } from 'react';
import type { WorldInfo } from '@island/protocol';
import type { ClientApiReason } from '../connection/api.ts';
import { apiReasonText } from './apiReasons.ts';
import { Field } from './Field.tsx';
import { RULE_TEXT, checkInviteCode, checkIslandName } from './fieldRules.ts';
import { CheckIcon, CopyIcon, LogOutIcon, PlayIcon, RefreshIcon } from './WorldIcons.tsx';
import './forms.css';

export interface WorldsScreenProps {
  username: string;
  worlds: readonly WorldInfo[];
  onOpen(worldId: string): void;
  /** Each of these returns null on success, else why the server refused. */
  onCreate(islandName: string): Promise<ClientApiReason | null>;
  onJoin(inviteCode: string, islandName: string): Promise<ClientApiReason | null>;
  onRegenerate(worldId: string): Promise<ClientApiReason | null>;
  onLogOut(): Promise<ClientApiReason | null>;
}

/** The invite code in two groups of five, easier to read out or retype; the server ignores spaces. */
function spaced(code: string): string {
  return code.length === 10 ? `${code.slice(0, 5)} ${code.slice(5)}` : code;
}

/**
 * The world screen (style A): the player's worlds to pick from, a creator's invite code with copy and a new code, and
 * the forms to create a world or join one. It is the screen for a player with no island or several worlds.
 */
export function WorldsScreen({ username, worlds, onOpen, onCreate, onJoin, onRegenerate, onLogOut }: WorldsScreenProps) {
  const [logOutError, setLogOutError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const logOut = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogOutError(null);
    const reason = await onLogOut();
    setLoggingOut(false);
    if (reason !== null) setLogOutError(apiReasonText(reason));
  };

  return (
    <main className="form-screen worlds-screen">
      <div className="worlds-column">
        <header className="worlds-header">
          <h1 className="form-title">{worlds.length === 0 ? 'No island yet' : 'Your worlds'}</h1>
          <p className="form-line">
            {worlds.length === 0
              ? `Hello, ${username}. Start a world of your own, or join a friend's with an invite code.`
              : `Hello, ${username}. Pick a world to open.`}
          </p>
        </header>
        {worlds.length > 0 && (
          <ul className="world-list">
            {worlds.map((world) => (
              <WorldCard key={world.id} world={world} onOpen={onOpen} onRegenerate={onRegenerate} />
            ))}
          </ul>
        )}
        <CreateWorldForm onCreate={onCreate} />
        <JoinWorldForm onJoin={onJoin} />
        {logOutError !== null && (
          <p className="form-error" role="alert">
            {logOutError}
          </p>
        )}
        <button className="form-link worlds-logout" type="button" onClick={() => void logOut()} disabled={loggingOut}>
          <LogOutIcon />
          Log out
        </button>
      </div>
    </main>
  );
}

function WorldCard({ world, onOpen, onRegenerate }: { world: WorldInfo; onOpen(id: string): void; onRegenerate(id: string): Promise<ClientApiReason | null> }) {
  return (
    <li className="world-card">
      <img className="world-picture" src="/icons/building_island-hall_a.png" alt="" width="256" height="256" />
      <div className="world-body">
        <h2 className="world-name">{world.islandName}</h2>
        <p className="world-owner">{`${world.creator}'s world`}</p>
        {world.status !== 'running' && <p className="world-note">This world is resting. It will wake up soon.</p>}
        {world.inviteCode !== null && <InviteCode worldId={world.id} code={world.inviteCode} onRegenerate={onRegenerate} />}
      </div>
      <button className="form-button world-open" type="button" aria-label={`Open ${world.islandName}`} onClick={() => onOpen(world.id)}>
        <PlayIcon />
        Open
      </button>
    </li>
  );
}

function InviteCode({ worldId, code, onRegenerate }: { worldId: string; code: string; onRegenerate(id: string): Promise<ClientApiReason | null> }) {
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const copy = async () => {
    setError(null);
    try {
      await navigator.clipboard.writeText(code);
      setNote('Copied');
    } catch {
      setNote('Select the code and copy it');
    }
  };

  const regenerate = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    const reason = await onRegenerate(worldId);
    setBusy(false);
    if (reason !== null) setError(apiReasonText(reason));
    else setNote('Here is the new code. The old code no longer works.');
  };

  return (
    <div className="invite">
      <p className="invite-label">Invite code for friends</p>
      <p className="invite-code" translate="no">
        {spaced(code)}
      </p>
      <div className="invite-actions">
        <button className="form-small-button" type="button" aria-label="Copy invite code" onClick={() => void copy()}>
          {note === 'Copied' ? <CheckIcon /> : <CopyIcon />}
          Copy
        </button>
        <button className="form-small-button" type="button" aria-label="New invite code" onClick={() => void regenerate()} disabled={busy}>
          <RefreshIcon />
          New code
        </button>
      </div>
      {note !== null && (
        <p className="invite-note" role="status">
          {note}
        </p>
      )}
      {error !== null && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function CreateWorldForm({ onCreate }: { onCreate(islandName: string): Promise<ClientApiReason | null> }) {
  const [islandName, setIslandName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const found = checkIslandName(islandName);
    setProblem(found);
    if (found !== null) return;
    setBusy(true);
    const reason = await onCreate(islandName);
    setBusy(false);
    if (reason !== null) setProblem(apiReasonText(reason));
    else setIslandName('');
  };

  return (
    <form className="form-card" noValidate onSubmit={(event) => void submit(event)}>
      <h2 className="form-subtitle">Start a new world</h2>
      <Field
        id="create-island-name"
        label="Island name"
        hint={RULE_TEXT.islandName}
        autoComplete="off"
        value={islandName}
        onChange={(event) => setIslandName(event.target.value)}
      />
      {problem !== null && (
        <p className="form-error" role="alert">
          {problem}
        </p>
      )}
      <button className="form-button" type="submit" disabled={busy}>
        Create world
      </button>
    </form>
  );
}

function JoinWorldForm({ onJoin }: { onJoin(inviteCode: string, islandName: string): Promise<ClientApiReason | null> }) {
  const [inviteCode, setInviteCode] = useState('');
  const [islandName, setIslandName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const found = checkInviteCode(inviteCode) ?? checkIslandName(islandName);
    setProblem(found);
    if (found !== null) return;
    setBusy(true);
    const reason = await onJoin(inviteCode, islandName);
    setBusy(false);
    if (reason !== null) setProblem(apiReasonText(reason));
  };

  return (
    <form className="form-card" noValidate onSubmit={(event) => void submit(event)}>
      <h2 className="form-subtitle">Join a friend's world</h2>
      <Field
        id="join-invite-code"
        label="Invite code"
        hint={RULE_TEXT.inviteCode}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        value={inviteCode}
        onChange={(event) => setInviteCode(event.target.value)}
      />
      <Field
        id="join-island-name"
        label="Island name"
        hint={RULE_TEXT.islandName}
        autoComplete="off"
        value={islandName}
        onChange={(event) => setIslandName(event.target.value)}
      />
      {problem !== null && (
        <p className="form-error" role="alert">
          {problem}
        </p>
      )}
      <button className="form-button" type="submit" disabled={busy}>
        Join world
      </button>
    </form>
  );
}
