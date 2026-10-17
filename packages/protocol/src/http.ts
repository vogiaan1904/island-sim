import { content } from '@island/content';
import * as v from 'valibot';
import { WorldId } from './fields.ts';
import type { WorldStatus } from './messages.ts';

// Account and world requests are HTTPS, not WebSocket messages, because only an HTTP response can set the httpOnly
// session cookie (island-server, accounts-and-security.md).

/** ASCII letters, digits, "-" and "_" (spec 12.3); compared in lowercase, shown as typed. */
export const Username = v.pipe(v.string(), v.minLength(3), v.maxLength(24), v.regex(/^[A-Za-z0-9_-]+$/));

/** At least 8 characters (spec 5.4), at most 128 so nobody can send megabytes to the hasher. */
export const Password = v.pipe(v.string(), v.minLength(8), v.maxLength(128));

/** The shape only (spec 12.3); the sim's claim command checks the rule as the final authority. */
export const IslandName = v.pipe(
  v.string(),
  v.minLength(content.rules.islandName.minLength),
  v.maxLength(content.rules.islandName.maxLength),
  v.regex(/^[A-Za-z0-9 '-]+$/),
);

export const INVITE_CODE_LENGTH = 10;
export const RESET_CODE_LENGTH = 12;

/** Codes are typed by hand: case, spaces and dashes do not matter. */
function code(length: number) {
  return v.pipe(
    v.string(),
    v.maxLength(64),
    v.transform((text) => text.toUpperCase().replace(/[\s-]/g, '')),
    v.regex(new RegExp(`^[A-Z0-9]{${length}}$`)),
  );
}

export const InviteCode = code(INVITE_CODE_LENGTH);
export const ResetCode = code(RESET_CODE_LENGTH);

// Logging in only bounds the fields, so a malformed name gets the same answer as a wrong password.
const AnyUsername = v.pipe(v.string(), v.maxLength(64));
const AnyPassword = v.pipe(v.string(), v.maxLength(128));

export const RegisterRequest = v.strictObject({
  username: Username,
  password: Password,
  inviteCode: InviteCode,
  islandName: IslandName,
});
export const LoginRequest = v.strictObject({ username: AnyUsername, password: AnyPassword });
export const ChangePasswordRequest = v.strictObject({ currentPassword: AnyPassword, newPassword: Password });
export const ResetPasswordRequest = v.strictObject({ username: AnyUsername, code: ResetCode, newPassword: Password });
export const CreateWorldRequest = v.strictObject({ islandName: IslandName });
export const JoinWorldRequest = v.strictObject({ inviteCode: InviteCode, islandName: IslandName });
export const RegenerateInviteRequest = v.strictObject({ world: WorldId });

export type RegisterRequest = v.InferOutput<typeof RegisterRequest>;
export type LoginRequest = v.InferOutput<typeof LoginRequest>;
export type ChangePasswordRequest = v.InferOutput<typeof ChangePasswordRequest>;
export type ResetPasswordRequest = v.InferOutput<typeof ResetPasswordRequest>;
export type CreateWorldRequest = v.InferOutput<typeof CreateWorldRequest>;
export type JoinWorldRequest = v.InferOutput<typeof JoinWorldRequest>;
export type RegenerateInviteRequest = v.InferOutput<typeof RegenerateInviteRequest>;

export interface AccountInfo {
  id: string;
  username: string;
}

export interface WorldInfo {
  id: string;
  /** The account's own island in this world. */
  slot: number;
  islandName: string;
  /** The username of the account that created the world. */
  creator: string;
  /** Shown to the world's creator only, who can share and regenerate it; null for everyone else. */
  inviteCode: string | null;
  status: WorldStatus;
}

/** GET /api/me */
export interface MeResponse {
  account: AccountInfo;
  worlds: WorldInfo[];
}

/** POST /api/register, /api/worlds and /api/worlds/join: the account and the world it now has an island in. */
export interface JoinedResponse {
  account: AccountInfo;
  world: WorldInfo;
}

/** POST /api/worlds/invite */
export interface InviteResponse {
  inviteCode: string;
}

export type ApiReason =
  | 'bad-request'
  | 'bad-origin'
  | 'too-large'
  | 'not-found'
  | 'not-signed-in'
  | 'bad-credentials'
  | 'username-taken'
  | 'bad-invite-code'
  | 'bad-reset-code'
  | 'too-many-attempts'
  | 'world-full'
  | 'world-resting'
  | 'already-has-island'
  | 'bad-island-name'
  | 'not-the-creator'
  | 'no-such-world'
  | 'server-error';

/** The body of every failed request. */
export interface ApiError {
  error: ApiReason;
}
