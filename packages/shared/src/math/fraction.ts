import type { ReadonlyDeep } from "type-fest";
import type { Fraction } from "../types/measurement.ts";

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

export function makeFraction(numerator: number, denominator: number): Fraction {
  if (denominator === 0) throw new Error("Denominator cannot be zero");
  if (numerator === 0) return { numerator: 0, denominator: 1 };
  const sign = denominator < 0 ? -1 : 1;
  const d = gcd(Math.abs(numerator), Math.abs(denominator));
  return {
    numerator: (sign * numerator) / d,
    denominator: (sign * denominator) / d,
  };
}

export function fractionFromInteger(n: number): Fraction {
  return { numerator: n, denominator: 1 };
}

export function simplify(f: ReadonlyDeep<Fraction>): Fraction {
  return makeFraction(f.numerator, f.denominator);
}

export function addFractions(a: ReadonlyDeep<Fraction>, b: ReadonlyDeep<Fraction>): Fraction {
  return makeFraction(
    a.numerator * b.denominator + b.numerator * a.denominator,
    a.denominator * b.denominator,
  );
}

export function clampToZero(f: ReadonlyDeep<Fraction>): Fraction {
  return f.numerator < 0
    ? { numerator: 0, denominator: 1 }
    : { numerator: f.numerator, denominator: f.denominator };
}

export function subtractFractions(a: ReadonlyDeep<Fraction>, b: ReadonlyDeep<Fraction>): Fraction {
  return makeFraction(
    a.numerator * b.denominator - b.numerator * a.denominator,
    a.denominator * b.denominator,
  );
}

export function multiplyFractions(a: ReadonlyDeep<Fraction>, b: ReadonlyDeep<Fraction>): Fraction {
  return makeFraction(a.numerator * b.numerator, a.denominator * b.denominator);
}

export function divideFractions(a: ReadonlyDeep<Fraction>, b: ReadonlyDeep<Fraction>): Fraction {
  if (b.numerator === 0) throw new Error("Cannot divide by zero");
  return makeFraction(a.numerator * b.denominator, a.denominator * b.numerator);
}

export function fractionsEqual(a: ReadonlyDeep<Fraction>, b: ReadonlyDeep<Fraction>): boolean {
  const sa = simplify(a);
  const sb = simplify(b);
  return sa.numerator === sb.numerator && sa.denominator === sb.denominator;
}

export function fractionToDecimal(f: ReadonlyDeep<Fraction>): number {
  return f.numerator / f.denominator;
}

export function integerPart(f: ReadonlyDeep<Fraction>): number {
  return Math.trunc(f.numerator / f.denominator);
}

export function fractionalPart(f: ReadonlyDeep<Fraction>): Fraction {
  const int = integerPart(f);
  return makeFraction(f.numerator - int * f.denominator, f.denominator);
}

export function formatFraction(f: ReadonlyDeep<Fraction>): string {
  const s = simplify(f);
  const int = integerPart(s);
  const frac = fractionalPart(s);
  if (frac.numerator === 0) return `${int === 0 ? "0" : int}`;
  if (int === 0) return `${frac.numerator}/${frac.denominator}`;
  return `${int} ${frac.numerator}/${frac.denominator}`;
}
