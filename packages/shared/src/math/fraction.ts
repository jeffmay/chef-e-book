import type { Fraction } from "../types/measurement.js";

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

export function make_fraction(numerator: number, denominator: number): Fraction {
  if (denominator === 0) throw new Error("Denominator cannot be zero");
  if (numerator === 0) return { numerator: 0, denominator: 1 };
  const sign = denominator < 0 ? -1 : 1;
  const d = gcd(Math.abs(numerator), Math.abs(denominator));
  return {
    numerator: (sign * numerator) / d,
    denominator: (sign * denominator) / d,
  };
}

export function fraction_from_integer(n: number): Fraction {
  return { numerator: n, denominator: 1 };
}

export function simplify(f: Fraction): Fraction {
  return make_fraction(f.numerator, f.denominator);
}

export function add_fractions(a: Fraction, b: Fraction): Fraction {
  return make_fraction(
    a.numerator * b.denominator + b.numerator * a.denominator,
    a.denominator * b.denominator,
  );
}

export function subtract_fractions(a: Fraction, b: Fraction): Fraction {
  return make_fraction(
    a.numerator * b.denominator - b.numerator * a.denominator,
    a.denominator * b.denominator,
  );
}

export function multiply_fractions(a: Fraction, b: Fraction): Fraction {
  return make_fraction(a.numerator * b.numerator, a.denominator * b.denominator);
}

export function divide_fractions(a: Fraction, b: Fraction): Fraction {
  if (b.numerator === 0) throw new Error("Cannot divide by zero");
  return make_fraction(a.numerator * b.denominator, a.denominator * b.numerator);
}

export function fractions_equal(a: Fraction, b: Fraction): boolean {
  const sa = simplify(a);
  const sb = simplify(b);
  return sa.numerator === sb.numerator && sa.denominator === sb.denominator;
}

export function fraction_to_decimal(f: Fraction): number {
  return f.numerator / f.denominator;
}

export function integer_part(f: Fraction): number {
  return Math.trunc(f.numerator / f.denominator);
}

export function fractional_part(f: Fraction): Fraction {
  const int = integer_part(f);
  return make_fraction(f.numerator - int * f.denominator, f.denominator);
}

export function format_fraction(f: Fraction): string {
  const s = simplify(f);
  const int = integer_part(s);
  const frac = fractional_part(s);
  if (frac.numerator === 0) return `${int === 0 ? "0" : int}`;
  if (int === 0) return `${frac.numerator}/${frac.denominator}`;
  return `${int} ${frac.numerator}/${frac.denominator}`;
}
