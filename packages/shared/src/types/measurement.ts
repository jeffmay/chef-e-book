import { type } from "arktype";

export const MeasurementType = type("'volume' | 'weight' | 'count'");
export type MeasurementType = typeof MeasurementType.infer;

export const VolumeUnit = [
  "tsp",
  "tbsp",
  "fl_oz",
  "cup",
  "pint",
  "quart",
  "gallon",
  "ml",
  "l"
] as const;
export type VolumeUnit = typeof VolumeUnit[number];

export const WeightUnit = ["oz", "lb", "g", "kg"] as const;
export type WeightUnit = typeof WeightUnit[number];

export const CountUnit = ["whole", "pinch", "dash"] as const;
export type CountUnit = typeof CountUnit[number];

export type MeasurementUnit = VolumeUnit | WeightUnit | CountUnit;

export interface Fraction {
  readonly numerator: number;
  readonly denominator: number;
}

export interface Measurement {
  readonly value: Fraction;
  readonly unit: MeasurementUnit;
}

export function unit_type(unit: MeasurementUnit): MeasurementType | undefined {
  if (VolumeUnit.includes(unit as VolumeUnit)) return "volume";
  if (WeightUnit.includes(unit as WeightUnit)) return "weight";
  if (CountUnit.includes(unit as CountUnit)) return "count";
}
