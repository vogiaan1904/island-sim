// Whole-number helpers. The sim's single rounding rule: always round down (floor).
// Fractions use one scale everywhere: permille (1000 = 100%).

export const PERMILLE = 1000;

export function assertSafeInt(value: number, what: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${what} must be a safe integer, got ${String(value)}`);
  }
}

/** floor(a * b / divisor) for a >= 0, b >= 0 and divisor > 0, exact for every safe-integer input. */
export function mulDivFloor(a: number, b: number, divisor: number): number {
  assertSafeInt(a, 'a');
  assertSafeInt(b, 'b');
  assertSafeInt(divisor, 'divisor');
  if (a < 0 || b < 0 || divisor <= 0) {
    throw new Error('mulDivFloor needs a >= 0, b >= 0 and divisor > 0');
  }
  const product = a * b;
  if (!Number.isSafeInteger(product)) {
    throw new Error(`mulDivFloor overflow: ${a} * ${b}`);
  }
  let quotient = Math.floor(product / divisor);
  while (quotient * divisor > product) quotient -= 1;
  while ((quotient + 1) * divisor <= product) quotient += 1;
  return quotient;
}

/** value * permille / 1000, rounded down. */
export function applyPermille(value: number, permille: number): number {
  return mulDivFloor(value, permille, PERMILLE);
}
