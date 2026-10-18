import type { PlayerCommand } from '@island/protocol';
import { useCallback, useState } from 'react';
import { useGame, useGameState } from '../session/game.tsx';
import { NOT_SENT_WORDS, reasonWords } from './reasonWords.ts';

/** What became of the last command a panel sent. */
export type CommandOutcome =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'ok'; data: Record<string, number> }
  /** Refused by the sim or the server, or never sent; `words` is what the player reads. */
  | { status: 'refused'; words: string };

/**
 * Sends player commands for a panel and follows the last one to its result. `send` returns false when nothing could
 * carry the command (reconnecting, a resting world): the outcome then says so in words. Reading the outcome never
 * re-renders on other commands' results.
 */
export function useCommand(): { send(command: PlayerCommand): boolean; outcome: CommandOutcome } {
  const { session } = useGame();
  const [sent, setSent] = useState<{ requestId: number | null } | null>(null);
  const settled = useGameState((state) => (sent?.requestId == null ? undefined : state.commands[sent.requestId]));
  const send = useCallback(
    (command: PlayerCommand) => {
      const requestId = session.command(command);
      setSent({ requestId });
      return requestId !== null;
    },
    [session],
  );
  let outcome: CommandOutcome = { status: 'idle' };
  if (sent !== null) {
    if (sent.requestId === null) outcome = { status: 'refused', words: NOT_SENT_WORDS };
    else if (settled === undefined || settled.status === 'pending') outcome = { status: 'pending' };
    else if (settled.status === 'ok') outcome = { status: 'ok', data: settled.data };
    else outcome = { status: 'refused', words: reasonWords(settled.reason, settled.shortfallCents) };
  }
  return { send, outcome };
}
