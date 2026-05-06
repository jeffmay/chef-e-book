import type { VolumeUnit, WeightUnit } from "../types/measurement.js";
import type { Fraction } from "../types/measurement.js";
import { make_fraction, multiply_fractions, divide_fractions, fractions_equal } from "./fraction.js";

// US customary volume: base unit is tsp (all conversions are exact integers)
const TSP_PER: Readonly<Record<VolumeUnit, Fraction | null>> = {
  tsp: make_fraction(1, 1),
  tbsp: make_fraction(3, 1),
  fl_oz: make_fraction(6, 1),
  cup: make_fraction(48, 1),
  pint: make_fraction(96, 1),
  quart: make_fraction(192, 1),
  gallon: make_fraction(768, 1),
  ml: null,
  l: null,
};

// Metric volume: base unit is ml (exact)
const ML_PER: Readonly<Record<VolumeUnit, Fraction | null>> = {
  ml: make_fraction(1, 1),
  l: make_fraction(1000, 1),
  tsp: null,
  tbsp: null,
  fl_oz: null,
  cup: null,
  pint: null,
  quart: null,
  gallon: null,
};

// US weight: base unit is oz (exact)
const OZ_PER: Readonly<Record<WeightUnit, Fraction | null>> = {
  oz: make_fraction(1, 1),
  lb: make_fraction(16, 1),
  g: null,
  kg: null,
};

// Metric weight: base unit is g (exact)
const G_PER: Readonly<Record<WeightUnit, Fraction | null>> = {
  g: make_fraction(1, 1),
  kg: make_fraction(1000, 1),
  oz: null,
  lb: null,
};

function same_system_volume(a: VolumeUnit, b: VolumeUnit): boolean {
  return (TSP_PER[a] !== null && TSP_PER[b] !== null) ||
    (ML_PER[a] !== null && ML_PER[b] !== null);
}

export function convert_volume(value: Fraction, from: VolumeUnit, to: VolumeUnit): Fraction {
  if (from === to) return value;
  const from_tsp = TSP_PER[from];
  const to_tsp = TSP_PER[to];
  if (from_tsp !== null && to_tsp !== null) {
    return divide_fractions(multiply_fractions(value, from_tsp), to_tsp);
  }
  const from_ml = ML_PER[from];
  const to_ml = ML_PER[to];
  if (from_ml !== null && to_ml !== null) {
    return divide_fractions(multiply_fractions(value, from_ml), to_ml);
  }
  throw new Error(`Cannot convert between ${from} and ${to}: different unit systems`);
}

export function convert_weight(value: Fraction, from: WeightUnit, to: WeightUnit): Fraction {
  if (from === to) return value;
  const from_oz = OZ_PER[from];
  const to_oz = OZ_PER[to];
  if (from_oz !== null && to_oz !== null) {
    return divide_fractions(multiply_fractions(value, from_oz), to_oz);
  }
  const from_g = G_PER[from];
  const to_g = G_PER[to];
  if (from_g !== null && to_g !== null) {
    return divide_fractions(multiply_fractions(value, from_g), to_g);
  }
  throw new Error(`Cannot convert between ${from} and ${to}: different unit systems`);
}

export function largest_whole_volume_unit(value: Fraction, base: VolumeUnit): VolumeUnit {
  const us_order: VolumeUnit[] = ["gallon", "quart", "pint", "cup", "fl_oz", "tbsp", "tsp"];
  const metric_order: VolumeUnit[] = ["l", "ml"];
  const candidates = same_system_volume(base, "tsp") ? us_order : metric_order;
  for (const candidate of candidates) {
    if (!same_system_volume(base, candidate)) continue;
    const converted = convert_volume(value, base, candidate);
    if (fractions_equal(converted, { numerator: Math.trunc(converted.numerator / converted.denominator), denominator: 1 })) {
      return candidate;
    }
  }
  return base;
}

export function largest_whole_weight_unit(value: Fraction, base: WeightUnit): WeightUnit {
  const us_order: WeightUnit[] = ["lb", "oz"];
  const metric_order: WeightUnit[] = ["kg", "g"];
  const candidates = OZ_PER[base] !== null ? us_order : metric_order;
  for (const candidate of candidates) {
    const converted = convert_weight(value, base, candidate);
    if (fractions_equal(converted, { numerator: Math.trunc(converted.numerator / converted.denominator), denominator: 1 })) {
      return candidate;
    }
  }
  return base;
}
