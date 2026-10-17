// Canonical JSON and the state hash (spec 12.2): a stable hash of the canonical serialized state, sorted keys.
// canonicalJson also guards determinism: it throws on anything the sim must not keep in state.

export function canonicalJson(value: unknown): string {
  return write(value, '$');
}

function write(value: unknown, path: string): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'string':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
        throw new Error(`canonicalJson: ${path} is not a safe integer (${String(value)})`);
      }
      return String(value);
    case 'object': {
      if (Array.isArray(value)) {
        const parts: string[] = [];
        for (let i = 0; i < value.length; i += 1) {
          if (!(i in value)) throw new Error(`canonicalJson: ${path}[${i}] is a hole`);
          parts.push(write(value[i], `${path}[${i}]`));
        }
        return `[${parts.join(',')}]`;
      }
      const proto: unknown = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) {
        throw new Error(`canonicalJson: ${path} is not a plain object`);
      }
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record).sort();
      const parts = keys.map((key) => `${JSON.stringify(key)}:${write(record[key], `${path}.${key}`)}`);
      return `{${parts.join(',')}}`;
    }
    default:
      throw new Error(`canonicalJson: ${path} has unsupported type ${typeof value}`);
  }
}

/** cyrb53: a fast, well-spread 53-bit string hash (public domain). */
export function cyrb53(text: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** The state hash: cyrb53 of the canonical JSON, as 14 hex digits. */
export function stateHash(value: unknown): string {
  return cyrb53(canonicalJson(value)).toString(16).padStart(14, '0');
}
