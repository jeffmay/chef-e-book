import { type } from "arktype";
import type { ValueOf } from "type-fest";
import { Companion, extend } from "./companion.ts";
import { EnumCompanion, is } from "./enums.ts";

export const MeasurementType = EnumCompanion("MeasurementType", ["volume", "weight", "count"]);
export type MeasurementType = typeof MeasurementType.type.infer;

export const VolumeUnit = EnumCompanion("VolumeUnit", [
  "tsp",
  "tbsp",
  "fl_oz",
  "cup",
  "pint",
  "quart",
  "gallon",
  "ml",
  "l",
]);
export type VolumeUnit = typeof VolumeUnit.type.infer;

export const WeightUnit = EnumCompanion("WeightUnit", ["oz", "lb", "g", "kg"]);
export type WeightUnit = typeof WeightUnit.type.infer;

export const CountUnit = EnumCompanion("CountUnit", ["whole", "pinch", "dash"]);
export type CountUnit = typeof CountUnit.type.infer;

export const MeasurementUnit = extend(
  EnumCompanion("MeasurementUnit", [
    ...VolumeUnit.values,
    ...WeightUnit.values,
    ...CountUnit.values,
  ]),
  (c) => {
    type Tranform<UnitValue> = UnitValue extends "l"
      ? "L"
      : UnitValue extends "fl_oz"
        ? "fl oz"
        : UnitValue;
    const display = {
      tsp: "tsp",
      tbsp: "tbsp",
      fl_oz: "fl oz",
      cup: "cup",
      pint: "pint",
      quart: "quart",
      gallon: "gallon",
      ml: "ml",
      l: "L",
      oz: "oz",
      lb: "lb",
      g: "g",
      kg: "kg",
      whole: "whole",
      pinch: "pinch",
      dash: "dash",
    } as const satisfies Record<(typeof c.values)[number], Tranform<(typeof c.values)[number]>>;
    return {
      ...c,
      display,
    };
  },
);
export type MeasurementUnit = typeof MeasurementUnit.type.infer;

export type MeasurementUnitDisplay = ValueOf<typeof MeasurementUnit.display>;

export const Fraction = Companion("Fraction", type({ numerator: "number", denominator: "number" }));
export type Fraction = typeof Fraction.type.infer;

export const Measurement = Companion(
  "Measurement",
  type({ value: Fraction.type, unit: MeasurementUnit.type }),
);
export type Measurement = typeof Measurement.type.infer;

export function unitType(unit: MeasurementUnit): MeasurementType | undefined {
  if (is(VolumeUnit, unit)) return "volume";
  if (is(WeightUnit, unit)) return "weight";
  if (is(CountUnit, unit)) return "count";
}
