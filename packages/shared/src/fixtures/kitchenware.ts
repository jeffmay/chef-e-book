import { type } from "arktype";
import Papa from "papaparse";
import { validOrThrow } from "../assertions/index.ts";
import { Companion } from "../types/companion.ts";
import { fixedId } from "../types/ids.ts";
import { KitchenwareId } from "../types/kitchenware.ts";
import { MeasurementType } from "../types/measurement.ts";
import { isInvalid, validate } from "../yjs/validation.ts";

export interface IngredientTemplate {
  readonly kind: "ingredient";
  readonly id: string;
  readonly name: string;
  readonly default_measurement_type: MeasurementType;
  readonly label_names: readonly string[];
  readonly parent_id?: string;
}

export interface ContainerTemplate {
  readonly kind: "container";
  readonly id: string;
  readonly name: string;
  readonly label_names: readonly string[];
}

export interface EquipmentTemplate {
  readonly kind: "equipment";
  readonly id: string;
  readonly name: string;
  readonly label_names: readonly string[];
}

export type KitchenwareTemplate = IngredientTemplate | ContainerTemplate | EquipmentTemplate;

const LabelNames = Companion(
  "LabelNames",
  type("string").pipe((s) =>
    s
      .split("+")
      .map((l) => l.trim())
      .filter((l) => l !== ""),
  ),
);

const IngredientRow = Companion(
  "IngredientRow",
  type({
    "Unique ID": "string",
    Description: "string",
    "Default Measurement Type": MeasurementType.type,
    Labels: LabelNames.type,
  }).pipe(
    (row): IngredientTemplate => ({
      kind: "ingredient",
      id: fixedId(KitchenwareId, row["Unique ID"].trim()),
      name: row["Description"],
      default_measurement_type: row["Default Measurement Type"],
      label_names: row["Labels"],
    }),
  ),
);

const ContainerRow = Companion(
  "ContainerRow",
  type({
    "Unique ID": "string",
    Description: "string",
    Labels: LabelNames.type,
  }).pipe(
    (row): ContainerTemplate => ({
      kind: "container",
      id: fixedId(KitchenwareId, row["Unique ID"].trim()),
      name: row["Description"],
      label_names: row["Labels"],
    }),
  ),
);

const EquipmentRow = Companion(
  "EquipmentRow",
  type({
    "Unique ID": "string",
    Description: "string",
    Labels: LabelNames.type,
  }).pipe(
    (row): EquipmentTemplate => ({
      kind: "equipment",
      id: fixedId(KitchenwareId, row["Unique ID"].trim()),
      name: row["Description"],
      label_names: row["Labels"],
    }),
  ),
);

export function parseKitchenwareCsv(csv: string): KitchenwareTemplate[] {
  const { data, errors } = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  if (errors.length > 0) throw new Error(`CSV parse error: ${errors[0]!.message}`);

  const results: KitchenwareTemplate[] = [];
  for (const rawRow of data) {
    const typeVal = (rawRow["Type"] ?? "").trim();
    const rawId = (rawRow["Unique ID"] ?? "unknown").trim();
    const rowId = validOrThrow(KitchenwareId.type(fixedId(KitchenwareId, rawId)));

    if (typeVal === "ingredient") {
      const mType = (rawRow["Default Measurement Type"] ?? "").trim();
      if (mType !== "volume" && mType !== "weight" && mType !== "count") {
        throw new Error(`Unknown measurement type "${mType}" for kitchenware "${rowId}"`);
      }
      const result = validate(IngredientRow, rawRow);
      if (isInvalid(result)) {
        throw new Error(`Malformed ingredient CSV row for "${rowId}": ${result.message}`);
      }
      results.push(result);
    } else if (typeVal === "container") {
      const result = validate(ContainerRow, rawRow);
      if (isInvalid(result)) {
        throw new Error(`Malformed container CSV row for "${rowId}": ${result.message}`);
      }
      results.push(result);
    } else if (typeVal === "equipment") {
      const result = validate(EquipmentRow, rawRow);
      if (isInvalid(result)) {
        throw new Error(`Malformed equipment CSV row for "${rowId}": ${result.message}`);
      }
      results.push(result);
    } else {
      throw new Error(`Unknown kitchenware type "${typeVal}" for id "${rowId}"`);
    }
  }
  return results;
}
