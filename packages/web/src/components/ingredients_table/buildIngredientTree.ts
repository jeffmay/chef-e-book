import {
  Companion,
  Ingredient,
  IngredientId,
  KitchenwareLabel,
  KitchenwareLabelId,
  Measurement,
  ScopedCompanion,
} from "@recipe-book/shared";
import { ReadonlyDeep, Simplify } from "type-fest";
import { type } from "arktype";

// Use scope syntax for the self-recursive `subRows` field — arktype's inline
// `"this[]"` reference trips a "shallow resolution cycle" parse error at
// module load.
const ingredientRowScope = type
  .scope({
    IngredientRow: {
      kind: "'ingredient'",
      id: () => IngredientId.type,
      name: "string",
      default_measurement_value: () => Measurement.type,
      labels: "string[]",
      "parent_id?": () => IngredientId.type,
      parent_name: "string",
      subRows: "IngredientRow[]",
    },
  })
  .export();

export const IngredientRow = ScopedCompanion(ingredientRowScope, "IngredientRow");

// Make the subRows field a readonly ref with mutable contents — safe to push during build
export type IngredientRow = Simplify<
  ReadonlyDeep<Omit<typeof IngredientRow.type.infer, "subRows">> & {
    readonly subRows: IngredientRow[];
  }
>;

export const IngredientRows = Companion("IngredientRow[]", IngredientRow.type.array());
export type IngredientRows = typeof IngredientRows.type.infer;

export function buildIngredientTree(
  ingredients: ReadonlyDeep<Ingredient[]>,
  item_labels: ReadonlyDeep<KitchenwareLabel[]>,
): IngredientRow[] {
  const labelNameById = new Map<KitchenwareLabelId, string>(item_labels.map((l) => [l.id, l.name]));
  const ingredientNameById = new Map<IngredientId, string>(ingredients.map((i) => [i.id, i.name]));

  const rowMap = new Map<IngredientId, IngredientRow>();

  for (const i of ingredients) {
    const label_names = [...i.labels]
      .map((id) => labelNameById.get(id) ?? id)
      .sort((a, b) => a.localeCompare(b));
    const row: IngredientRow = {
      kind: "ingredient",
      id: i.id,
      name: i.name,
      default_measurement_value: i.default_measurement_value,
      labels: label_names,
      parent_name:
        i.parent_id !== undefined ? (ingredientNameById.get(i.parent_id) ?? i.parent_id) : "",
      subRows: [],
      ...(i.parent_id !== undefined && { parent_id: i.parent_id }),
    };
    rowMap.set(i.id, row);
  }

  const roots: IngredientRow[] = [];

  for (const row of rowMap.values()) {
    if (row.parent_id !== undefined) {
      const parent = rowMap.get(row.parent_id);
      if (parent !== undefined) {
        parent.subRows.push(row);
        continue;
      }
    }
    roots.push(row);
  }

  function sortLevel(rows: IngredientRow[]): void {
    rows.sort((a, b) => a.name.localeCompare(b.name));
    for (const r of rows) sortLevel(r.subRows);
  }
  sortLevel(roots);

  return roots;
}
