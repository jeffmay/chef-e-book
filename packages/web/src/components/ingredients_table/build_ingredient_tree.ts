import { Ingredient, IngredientId, KitchenwareLabel, KitchenwareLabelId, Measurement } from "@recipe-book/shared";
import { ReadonlyDeep, Simplify } from "type-fest";
import { type } from "arktype";
import { ScopedCompanion } from "@recipe-book/shared/src/types/companion";

// Use scope syntax for the self-recursive `subRows` field — arktype's inline
// `"this[]"` reference trips a "shallow resolution cycle" parse error at
// module load.
const ingredientRowScope = type.scope({
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
}).export();

export const IngredientRow = ScopedCompanion(ingredientRowScope, "IngredientRow");

// Make the subRows field a readonly ref with mutable contents — safe to push during build
export type IngredientRow = Simplify<ReadonlyDeep<Omit<typeof IngredientRow.type.infer, "subRows">> & {
  readonly subRows: IngredientRow[]
}>;

export function buildIngredientTree(
  ingredients: ReadonlyDeep<Ingredient[]>,
  item_labels: ReadonlyDeep<KitchenwareLabel[]>,
): IngredientRow[] {
  const label_name_by_id = new Map<KitchenwareLabelId, string>(item_labels.map((l) => [l.id, l.name]));
  const ingredient_name_by_id = new Map<IngredientId, string>(ingredients.map((i) => [i.id, i.name]));

  const row_map = new Map<IngredientId, IngredientRow>();

  for (const i of ingredients) {
    const label_names = [...i.labels]
      .map((id) => label_name_by_id.get(id) ?? id)
      .sort((a, b) => a.localeCompare(b));
    const row: IngredientRow = {
      kind: "ingredient",
      id: i.id,
      name: i.name,
      default_measurement_value: i.default_measurement_value,
      labels: label_names,
      parent_name:
        i.parent_id !== undefined ? (ingredient_name_by_id.get(i.parent_id) ?? i.parent_id) : "",
      subRows: [],
      ...(i.parent_id !== undefined && { parent_id: i.parent_id }),
    };
    row_map.set(i.id, row);
  }

  const roots: IngredientRow[] = [];

  for (const row of row_map.values()) {
    if (row.parent_id !== undefined) {
      const parent = row_map.get(row.parent_id);
      if (parent !== undefined) {
        parent.subRows.push(row);
        continue;
      }
    }
    roots.push(row);
  }

  function sort_level(rows: IngredientRow[]): void {
    rows.sort((a, b) => a.name.localeCompare(b.name));
    for (const r of rows) sort_level(r.subRows);
  }
  sort_level(roots);

  return roots;
}
