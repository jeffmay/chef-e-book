import { describe, it, expect } from "vitest";
import {
  make_fraction,
  simplify,
  add_fractions,
  subtract_fractions,
  multiply_fractions,
  divide_fractions,
  fractions_equal,
  integer_part,
  fractional_part,
  format_fraction,
  fraction_from_integer,
} from "../fraction.js";

describe("make_fraction", () => {
  it("simplifies to lowest terms", () => {
    expect(make_fraction(4, 8)).toEqual({ numerator: 1, denominator: 2 });
    expect(make_fraction(6, 9)).toEqual({ numerator: 2, denominator: 3 });
  });

  it("normalizes sign to numerator", () => {
    expect(make_fraction(-1, 2)).toEqual({ numerator: -1, denominator: 2 });
    expect(make_fraction(1, -2)).toEqual({ numerator: -1, denominator: 2 });
    expect(make_fraction(-1, -2)).toEqual({ numerator: 1, denominator: 2 });
  });

  it("returns 0/1 for zero numerator", () => {
    expect(make_fraction(0, 5)).toEqual({ numerator: 0, denominator: 1 });
  });

  it("throws on zero denominator", () => {
    expect(() => make_fraction(1, 0)).toThrow("Denominator cannot be zero");
  });
});

describe("fraction_from_integer", () => {
  it("creates a unit fraction from an integer", () => {
    expect(fraction_from_integer(3)).toEqual({ numerator: 3, denominator: 1 });
  });
});

describe("simplify", () => {
  it("simplifies unsimplified fraction", () => {
    expect(simplify({ numerator: 2, denominator: 4 })).toEqual({
      numerator: 1,
      denominator: 2,
    });
  });
});

describe("arithmetic", () => {
  it("adds fractions", () => {
    expect(add_fractions(make_fraction(1, 2), make_fraction(1, 3))).toEqual(
      make_fraction(5, 6),
    );
  });

  it("subtracts fractions", () => {
    expect(subtract_fractions(make_fraction(3, 4), make_fraction(1, 4))).toEqual(
      make_fraction(1, 2),
    );
  });

  it("multiplies fractions", () => {
    expect(multiply_fractions(make_fraction(2, 3), make_fraction(3, 4))).toEqual(
      make_fraction(1, 2),
    );
  });

  it("divides fractions", () => {
    expect(divide_fractions(make_fraction(1, 2), make_fraction(1, 4))).toEqual(
      make_fraction(2, 1),
    );
  });

  it("throws when dividing by zero", () => {
    expect(() => divide_fractions(make_fraction(1, 2), make_fraction(0, 1))).toThrow();
  });
});

describe("fractions_equal", () => {
  it("considers equivalent fractions equal", () => {
    expect(fractions_equal(make_fraction(1, 2), make_fraction(2, 4))).toBe(true);
    expect(fractions_equal(make_fraction(1, 2), make_fraction(1, 3))).toBe(false);
  });
});

describe("integer_part and fractional_part", () => {
  it("splits mixed number correctly", () => {
    const f = make_fraction(7, 4);
    expect(integer_part(f)).toBe(1);
    expect(fractional_part(f)).toEqual(make_fraction(3, 4));
  });

  it("handles whole numbers", () => {
    const f = make_fraction(4, 2);
    expect(integer_part(f)).toBe(2);
    expect(fractional_part(f)).toEqual(make_fraction(0, 1));
  });
});

describe("format_fraction", () => {
  it("formats zero", () => {
    expect(format_fraction(make_fraction(0, 1))).toBe("0");
  });

  it("formats whole number", () => {
    expect(format_fraction(make_fraction(3, 1))).toBe("3");
  });

  it("formats proper fraction", () => {
    expect(format_fraction(make_fraction(1, 2))).toBe("1/2");
  });

  it("formats mixed number", () => {
    expect(format_fraction(make_fraction(7, 4))).toBe("1 3/4");
  });
});
