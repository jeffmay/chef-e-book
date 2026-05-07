import type { MeasurementType } from "../types/measurement.js";

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

interface RawRow {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly default_measurement_type: string;
  readonly labels: string;
}

function parse_csv_rows(csv: string): RawRow[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const rows: RawRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined || line.trim() === "") continue;
    const cols = line.split(",");
    if (cols.length < 5) throw new Error(`Malformed kitchenware CSV row ${i + 1}: ${line}`);
    const [id, type, name, default_measurement_type, ...label_parts] = cols;
    if (
      id === undefined ||
      type === undefined ||
      name === undefined ||
      default_measurement_type === undefined
    ) {
      throw new Error(`Missing required fields in kitchenware CSV row ${i + 1}: ${line}`);
    }
    rows.push({
      id: id.trim(),
      type: type.trim(),
      name: name.trim(),
      default_measurement_type: default_measurement_type.trim(),
      labels: label_parts.join(",").trim(),
    });
  }
  return rows;
}

function parse_measurement_type(raw: string, row_id: string): MeasurementType {
  if (raw === "volume" || raw === "weight" || raw === "count") return raw;
  throw new Error(`Unknown measurement type "${raw}" for kitchenware "${row_id}"`);
}

function parse_label_names(raw: string): string[] {
  if (raw === "") return [];
  return raw
    .split("+")
    .map((l) => l.trim())
    .filter((l) => l !== "");
}

function parse_ingredient_template(row: RawRow): IngredientTemplate {
  return {
    kind: "ingredient",
    id: row.id,
    name: row.name,
    default_measurement_type: parse_measurement_type(row.default_measurement_type, row.id),
    label_names: parse_label_names(row.labels),
  };
}

function parse_container_template(row: RawRow): ContainerTemplate {
  return {
    kind: "container",
    id: row.id,
    name: row.name,
    label_names: parse_label_names(row.labels),
  };
}

function parse_equipment_template(row: RawRow): EquipmentTemplate {
  return {
    kind: "equipment",
    id: row.id,
    name: row.name,
    label_names: parse_label_names(row.labels),
  };
}

export function parse_kitchenware_csv(csv: string): KitchenwareTemplate[] {
  const rows = parse_csv_rows(csv);
  return rows.map((row) => {
    if (row.type === "ingredient") return parse_ingredient_template(row);
    if (row.type === "container") return parse_container_template(row);
    if (row.type === "equipment") return parse_equipment_template(row);
    throw new Error(`Unknown kitchenware type "${row.type}" for id "${row.id}"`);
  });
}
