import { describe, it, expect } from "vitest";
import {
  makeFraction,
  simplify,
  addFractions,
  subtractFractions,
  multiplyFractions,
  divideFractions,
  fractionsEqual,
  integerPart,
  fractionalPart,
  formatFraction,
  fractionFromInteger,
  clampToZero,
} from "../fraction.ts";

describe("makeFraction", () => {
  it("simplifies to lowest terms", () => {
    expect(makeFraction(4, 8)).toEqual({ numerator: 1, denominator: 2 });
    expect(makeFraction(6, 9)).toEqual({ numerator: 2, denominator: 3 });
  });

  it("normalizes sign to numerator", () => {
    expect(makeFraction(-1, 2)).toEqual({ numerator: -1, denominator: 2 });
    expect(makeFraction(1, -2)).toEqual({ numerator: -1, denominator: 2 });
    expect(makeFraction(-1, -2)).toEqual({ numerator: 1, denominator: 2 });
  });

  it("returns 0/1 for zero numerator", () => {
    expect(makeFraction(0, 5)).toEqual({ numerator: 0, denominator: 1 });
  });

  it("throws on zero denominator", () => {
    expect(() => makeFraction(1, 0)).toThrow("Denominator cannot be zero");
  });
});

describe("fractionFromInteger", () => {
  it("creates a unit fraction from an integer", () => {
    expect(fractionFromInteger(3)).toEqual({ numerator: 3, denominator: 1 });
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
    expect(addFractions(makeFraction(1, 2), makeFraction(1, 3))).toEqual(makeFraction(5, 6));
  });

  it("subtracts fractions", () => {
    expect(subtractFractions(makeFraction(3, 4), makeFraction(1, 4))).toEqual(makeFraction(1, 2));
  });

  it("multiplies fractions", () => {
    expect(multiplyFractions(makeFraction(2, 3), makeFraction(3, 4))).toEqual(makeFraction(1, 2));
  });

  it("divides fractions", () => {
    expect(divideFractions(makeFraction(1, 2), makeFraction(1, 4))).toEqual(makeFraction(2, 1));
  });

  it("throws when dividing by zero", () => {
    expect(() => divideFractions(makeFraction(1, 2), makeFraction(0, 1))).toThrow();
  });
});

describe("fractionsEqual", () => {
  it("considers equivalent fractions equal", () => {
    expect(fractionsEqual(makeFraction(1, 2), makeFraction(2, 4))).toBe(true);
    expect(fractionsEqual(makeFraction(1, 2), makeFraction(1, 3))).toBe(false);
  });
});

describe("integerPart and fractionalPart", () => {
  it("splits mixed number correctly", () => {
    const f = makeFraction(7, 4);
    expect(integerPart(f)).toBe(1);
    expect(fractionalPart(f)).toEqual(makeFraction(3, 4));
  });

  it("handles whole numbers", () => {
    const f = makeFraction(4, 2);
    expect(integerPart(f)).toBe(2);
    expect(fractionalPart(f)).toEqual(makeFraction(0, 1));
  });
});

describe("clampToZero", () => {
  it("returns the same fraction for a positive value", () => {
    expect(clampToZero(makeFraction(3, 4))).toEqual(makeFraction(3, 4));
  });

  it("returns the same fraction for zero", () => {
    expect(clampToZero(makeFraction(0, 1))).toEqual(makeFraction(0, 1));
  });

  it("returns zero for a negative fraction", () => {
    expect(clampToZero(makeFraction(-3, 4))).toEqual(makeFraction(0, 1));
  });

  it("returns zero for a negative whole number", () => {
    expect(clampToZero(makeFraction(-5, 1))).toEqual(makeFraction(0, 1));
  });

  it("returns zero for a negative improper fraction", () => {
    expect(clampToZero(makeFraction(-7, 3))).toEqual(makeFraction(0, 1));
  });

  it("passes through an already-simplified positive fraction unchanged", () => {
    const f = { numerator: 5, denominator: 8 };
    expect(clampToZero(f)).toEqual(f);
  });
});

describe("formatFraction", () => {
  it("formats zero", () => {
    expect(formatFraction(makeFraction(0, 1))).toBe("0");
  });

  it("formats whole number", () => {
    expect(formatFraction(makeFraction(3, 1))).toBe("3");
  });

  it("formats proper fraction", () => {
    expect(formatFraction(makeFraction(1, 2))).toBe("1/2");
  });

  it("formats mixed number", () => {
    expect(formatFraction(makeFraction(7, 4))).toBe("1 3/4");
  });
});
