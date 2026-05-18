import { type } from "arktype";
import Papa from "papaparse";
import { validOrThrow } from "../assertions/index.js";
import { paddedId } from "../types/ids.js";
import { KitchenwareId } from "../types/kitchenware.js";
import { MeasurementType } from "../types/measurement.js";

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

const LabelNames = type("string").pipe((s) =>
  s
    .split("+")
    .map((l) => l.trim())
    .filter((l) => l !== ""),
);

const IngredientRow = type({
  "Unique ID": "string",
  "Description": "string",
  "Default Measurement Type": MeasurementType.type,
  "Labels": LabelNames,
}).pipe(
  (row): IngredientTemplate => ({
    kind: "ingredient",
    id: paddedId(KitchenwareId, row["Unique ID"].trim()),
    name: row["Description"],
    default_measurement_type: row["Default Measurement Type"],
    label_names: row["Labels"],
  }),
);

const ContainerRow = type({
  "Unique ID": "string",
  "Description": "string",
  "Labels": LabelNames,
}).pipe(
  (row): ContainerTemplate => ({
    kind: "container",
    id: paddedId(KitchenwareId, row["Unique ID"].trim()),
    name: row["Description"],
    label_names: row["Labels"],
  }),
);

const EquipmentRow = type({
  "Unique ID": "string",
  "Description": "string",
  "Labels": LabelNames,
}).pipe(
  (row): EquipmentTemplate => ({
    kind: "equipment",
    id: paddedId(KitchenwareId, row["Unique ID"].trim()),
    name: row["Description"],
    label_names: row["Labels"],
  }),
);

export function parseKitchenwareCsv(csv: string): KitchenwareTemplate[] {
  const { data, errors } = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  if (errors.length > 0) throw new Error(`CSV parse error: ${errors[0]!.message}`);

  const results: KitchenwareTemplate[] = [];
  for (const raw_row of data) {
    const type_val = (raw_row["Type"] ?? "").trim();
    const raw_id = (raw_row["Unique ID"] ?? "unknown").trim();
    const row_id = validOrThrow(KitchenwareId.type(paddedId(KitchenwareId, raw_id)));

    if (type_val === "ingredient") {
      const mtype = (raw_row["Default Measurement Type"] ?? "").trim();
      if (mtype !== "volume" && mtype !== "weight" && mtype !== "count") {
        throw new Error(`Unknown measurement type "${mtype}" for kitchenware "${row_id}"`);
      }
      const result = IngredientRow(raw_row);
      if (result instanceof type.errors) {
        throw new Error(`Malformed ingredient CSV row for "${row_id}": ${result.summary}`);
      }
      results.push(result);
    } else if (type_val === "container") {
      const result = ContainerRow(raw_row);
      if (result instanceof type.errors) {
        throw new Error(`Malformed container CSV row for "${row_id}": ${result.summary}`);
      }
      results.push(result);
    } else if (type_val === "equipment") {
      const result = EquipmentRow(raw_row);
      if (result instanceof type.errors) {
        throw new Error(`Malformed equipment CSV row for "${row_id}": ${result.summary}`);
      }
      results.push(result);
    } else {
      throw new Error(`Unknown kitchenware type "${type_val}" for id "${row_id}"`);
    }
  }
  return results;
}
