import { describe, it, expect } from "vitest";
import { convert_volume, convert_weight, largest_whole_volume_unit, largest_whole_weight_unit } from "../units.js";
import { make_fraction, fractions_equal, fraction_to_decimal } from "../fraction.js";

describe("convert_volume", () => {
  it("returns same value when units match", () => {
    const f = make_fraction(1, 2);
    expect(convert_volume(f, "cup", "cup")).toBe(f);
  });

  it("converts 3 tsp to 1 tbsp", () => {
    const result = convert_volume(make_fraction(3, 1), "tsp", "tbsp");
    expect(Math.abs(fraction_to_decimal(result) - 1)).toBeLessThan(0.001);
  });

  it("converts 16 tbsp to 1 cup", () => {
    const result = convert_volume(make_fraction(16, 1), "tbsp", "cup");
    expect(Math.abs(fraction_to_decimal(result) - 1)).toBeLessThan(0.001);
  });

  it("converts 1000 ml to 1 l", () => {
    const result = convert_volume(make_fraction(1000, 1), "ml", "l");
    expect(fractions_equal(result, make_fraction(1, 1))).toBe(true);
  });
});

describe("convert_weight", () => {
  it("returns same value when units match", () => {
    const f = make_fraction(1, 2);
    expect(convert_weight(f, "g", "g")).toBe(f);
  });

  it("converts 1000 g to 1 kg", () => {
    const result = convert_weight(make_fraction(1000, 1), "g", "kg");
    expect(fractions_equal(result, make_fraction(1, 1))).toBe(true);
  });
});

describe("largest_whole_volume_unit", () => {
  it("picks cup when 16 tbsp", () => {
    expect(largest_whole_volume_unit(make_fraction(16, 1), "tbsp")).toBe("cup");
  });

  it("stays at ml when no larger unit divides evenly", () => {
    expect(largest_whole_volume_unit(make_fraction(1, 1), "ml")).toBe("ml");
  });
});

describe("largest_whole_weight_unit", () => {
  it("picks kg for 1000 g", () => {
    expect(largest_whole_weight_unit(make_fraction(1000, 1), "g")).toBe("kg");
  });
});
