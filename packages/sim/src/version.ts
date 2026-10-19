import type { Content } from '@island/content';
import { stateHash } from './hash.ts';

/** Version of the sim's rules and state shape. Bump it when saved state changes shape, with a migration (spec 12.2). */
export const SIM_VERSION = 5;

/**
 * Names the content numbers the rules run on. Replay is exact only with the same sim version and the same content, so
 * the server records both with every logged command and snapshot (spec 12.2).
 */
export function contentHash(content: Content): string {
  return stateHash(content);
}
