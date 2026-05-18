import { type } from "arktype";
import { Companion } from "./companion";
import { EnumCompanion, is } from "./enums";

export const MeasurementType = EnumCompanion("MeasurementType", ["volume", "weight", "count"]);
export type MeasurementType = typeof MeasurementType.type.infer;

export const VolumeUnit = EnumCompanion("VolumeUnit", ["tsp", "tbsp", "fl_oz", "cup", "pint", "quart", "gallon", "ml", "l"]);
export type VolumeUnit = typeof VolumeUnit.type.infer;

export const WeightUnit = EnumCompanion("WeightUnit", ["oz", "lb", "g", "kg"]);
export type WeightUnit = typeof WeightUnit.type.infer;

export const CountUnit = EnumCompanion("CountUnit", ["whole", "pinch", "dash"]);
export type CountUnit = typeof CountUnit.type.infer;

export const MeasurementUnit = Companion("MeasurementUnit", type.or(VolumeUnit.type, WeightUnit.type, CountUnit.type));
export type MeasurementUnit = typeof MeasurementUnit.type.infer;

export const Fraction = Companion("Fraction", type({ numerator: "number", denominator: "number" }));
export type Fraction = typeof Fraction.type.infer;

export const Measurement = Companion("Measurement", type({ value: Fraction.type, unit: MeasurementUnit.type }));
export type Measurement = typeof Measurement.type.infer;

export function unitType(unit: MeasurementUnit): MeasurementType | undefined {
  if (is(VolumeUnit, unit)) return "volume";
  if (is(WeightUnit, unit)) return "weight";
  if (is(CountUnit, unit)) return "count";
}
