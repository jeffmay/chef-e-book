import type { ReadonlyDeep } from "type-fest";
import type { Fraction, VolumeUnit, WeightUnit } from "../types/measurement.ts";
import { divideFractions, fractionsEqual, makeFraction, multiplyFractions } from "./fraction.ts";

// US customary volume: base unit is tsp (all conversions are exact integers)
const TSP_PER: ReadonlyDeep<Record<VolumeUnit, Fraction | null>> = {
  tsp: makeFraction(1, 1),
  tbsp: makeFraction(3, 1),
  fl_oz: makeFraction(6, 1),
  cup: makeFraction(48, 1),
  pint: makeFraction(96, 1),
  quart: makeFraction(192, 1),
  gallon: makeFraction(768, 1),
  ml: null,
  l: null,
};

// Metric volume: base unit is ml (exact)
const ML_PER: ReadonlyDeep<Record<VolumeUnit, Fraction | null>> = {
  ml: makeFraction(1, 1),
  l: makeFraction(1000, 1),
  tsp: null,
  tbsp: null,
  fl_oz: null,
  cup: null,
  pint: null,
  quart: null,
  gallon: null,
};

// US weight: base unit is oz (exact)
const OZ_PER: ReadonlyDeep<Record<WeightUnit, Fraction | null>> = {
  oz: makeFraction(1, 1),
  lb: makeFraction(16, 1),
  g: null,
  kg: null,
};

// Metric weight: base unit is g (exact)
const G_PER: ReadonlyDeep<Record<WeightUnit, Fraction | null>> = {
  g: makeFraction(1, 1),
  kg: makeFraction(1000, 1),
  oz: null,
  lb: null,
};

function sameSystemVolume(a: VolumeUnit, b: VolumeUnit): boolean {
  return (TSP_PER[a] !== null && TSP_PER[b] !== null) || (ML_PER[a] !== null && ML_PER[b] !== null);
}

export function convertVolume(
  value: ReadonlyDeep<Fraction>,
  from: VolumeUnit,
  to: VolumeUnit,
): Fraction {
  if (from === to) return value;
  const fromTsp = TSP_PER[from];
  const toTsp = TSP_PER[to];
  if (fromTsp !== null && toTsp !== null) {
    return divideFractions(multiplyFractions(value, fromTsp), toTsp);
  }
  const fromMl = ML_PER[from];
  const toMl = ML_PER[to];
  if (fromMl !== null && toMl !== null) {
    return divideFractions(multiplyFractions(value, fromMl), toMl);
  }
  throw new Error(`Cannot convert between ${from} and ${to}: different unit systems`);
}

export function convertWeight(
  value: ReadonlyDeep<Fraction>,
  from: WeightUnit,
  to: WeightUnit,
): Fraction {
  if (from === to) return value;
  const fromOz = OZ_PER[from];
  const toOz = OZ_PER[to];
  if (fromOz !== null && toOz !== null) {
    return divideFractions(multiplyFractions(value, fromOz), toOz);
  }
  const fromG = G_PER[from];
  const toG = G_PER[to];
  if (fromG !== null && toG !== null) {
    return divideFractions(multiplyFractions(value, fromG), toG);
  }
  throw new Error(`Cannot convert between ${from} and ${to}: different unit systems`);
}

export function largestWholeVolumeUnit(
  value: ReadonlyDeep<Fraction>,
  base: VolumeUnit,
): VolumeUnit {
  const usOrder: VolumeUnit[] = ["gallon", "quart", "pint", "cup", "fl_oz", "tbsp", "tsp"];
  const metricOrder: VolumeUnit[] = ["l", "ml"];
  const candidates = sameSystemVolume(base, "tsp") ? usOrder : metricOrder;
  for (const candidate of candidates) {
    if (!sameSystemVolume(base, candidate)) continue;
    const converted = convertVolume(value, base, candidate);
    if (
      fractionsEqual(converted, {
        numerator: Math.trunc(converted.numerator / converted.denominator),
        denominator: 1,
      })
    ) {
      return candidate;
    }
  }
  return base;
}

export function largestWholeWeightUnit(
  value: ReadonlyDeep<Fraction>,
  base: WeightUnit,
): WeightUnit {
  const usOrder: WeightUnit[] = ["lb", "oz"];
  const metricOrder: WeightUnit[] = ["kg", "g"];
  const candidates = OZ_PER[base] !== null ? usOrder : metricOrder;
  for (const candidate of candidates) {
    const converted = convertWeight(value, base, candidate);
    if (
      fractionsEqual(converted, {
        numerator: Math.trunc(converted.numerator / converted.denominator),
        denominator: 1,
      })
    ) {
      return candidate;
    }
  }
  return base;
}
