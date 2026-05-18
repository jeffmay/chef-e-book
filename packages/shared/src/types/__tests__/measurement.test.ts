import { describe, it, expect } from "vitest";
import { type } from "arktype";
import { unitType, VolumeUnit, WeightUnit, CountUnit, Fraction, Measurement } from "../measurement.js";
import { is } from "../enums.js";

describe("unitType", () => {
  it("classifies volume units", () => {
    expect(unitType("tsp")).toBe("volume");
    expect(unitType("tbsp")).toBe("volume");
    expect(unitType("cup")).toBe("volume");
    expect(unitType("ml")).toBe("volume");
    expect(unitType("l")).toBe("volume");
  });

  it("classifies weight units", () => {
    expect(unitType("oz")).toBe("weight");
    expect(unitType("lb")).toBe("weight");
    expect(unitType("g")).toBe("weight");
    expect(unitType("kg")).toBe("weight");
  });

  it("classifies count units", () => {
    expect(unitType("whole")).toBe("count");
    expect(unitType("pinch")).toBe("count");
    expect(unitType("dash")).toBe("count");
  });
});

describe("unit schemas", () => {
  it("VolumeUnit accepts valid units and rejects invalid ones", () => {
    expect(is(VolumeUnit, "cup")).toBe(true);
    expect(is(VolumeUnit, "ml")).toBe(true);
    expect(is(VolumeUnit, "oz")).toBe(false);
    expect(is(VolumeUnit, "bad")).toBe(false);
  });

  it("WeightUnit accepts valid units and rejects invalid ones", () => {
    expect(is(WeightUnit, "oz")).toBe(true);
    expect(is(WeightUnit, "kg")).toBe(true);
    expect(is(WeightUnit, "cup")).toBe(false);
  });

  it("CountUnit accepts valid units and rejects invalid ones", () => {
    expect(is(CountUnit, "whole")).toBe(true);
    expect(is(CountUnit, "tsp")).toBe(false);
  });
});

describe("Fraction schema", () => {
  it("accepts valid fractions", () => {
    expect(Fraction.type({ numerator: 1, denominator: 2 }) instanceof type.errors).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(Fraction.type({ numerator: 1 }) instanceof type.errors).toBe(true);
    expect(Fraction.type({}) instanceof type.errors).toBe(true);
  });
});

describe("Measurement schema", () => {
  it("accepts a valid measurement", () => {
    const result = Measurement.type({ value: { numerator: 1, denominator: 2 }, unit: "cup" });
    expect(result instanceof type.errors).toBe(false);
  });

  it("rejects an invalid unit", () => {
    const result = Measurement.type({ value: { numerator: 1, denominator: 2 }, unit: "bad" });
    expect(result instanceof type.errors).toBe(true);
  });
});
