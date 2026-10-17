import { hash, verify } from '@node-rs/argon2';

// argon2id (spec 5.4) with the OWASP parameters: 19 MiB, 2 passes, 1 lane. The library hashes on a worker thread, so
// hashing never stalls the worlds' ticks (island-server, accounts-and-security.md).

const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

/** False for a wrong password and for a hash that cannot be read. */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
