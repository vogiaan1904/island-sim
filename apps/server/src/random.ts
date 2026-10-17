import { randomInt, randomUUID } from 'node:crypto';

// Server-side randomness: ids, seeds and codes. The sim's own randomness lives in its seeded stream (spec 4.1).

/** Letters and digits that are hard to mix up when read aloud or typed on a phone: no 0, O, 1, I or L. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function newId(): string {
  return randomUUID();
}

/** A world seed for the sim's archipelago generator: 0 to 2^32 - 1. */
export function newSeed(): number {
  return randomInt(0, 0x1_0000_0000);
}

/** A code a person types: invite codes and password reset codes. */
export function newCode(length: number): string {
  let code = '';
  for (let i = 0; i < length; i += 1) code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  return code;
}
