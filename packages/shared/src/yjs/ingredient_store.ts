import { type } from "arktype";
import * as Y from "yjs";
import { is_type_error } from "../assertions/index.js";
import type { KitchenwareTemplate } from "../fixtures/parse_kitchenware_csv.js";
import { load_id } from "../types/ids.js";
import { Ingredient, IngredientId, KitchenwareKind, KitchenwareLabelId } from "../types/kitchenware.js";
import { MeasurementType } from "../types/measurement.js";
import { setOf } from "../types/sets.js";
import { find_or_create_label, get_labels_ymap } from "./label_store.js";

const MAP_KEY = "ingredients";

const DEFAULT_INGREDIENT_KINDS: ReadonlySet<KitchenwareKind> = new Set(["ingredient"]);

export function get_ingredient_ymap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(MAP_KEY);
}

const StoredIngredient = type({
  name: "string",
  default_measurement_type: MeasurementType,
  labels: setOf<KitchenwareLabelId>(KitchenwareLabelId.type),
  "parent_id?": IngredientId.type,
});

function to_stored(i: Ingredient) {
  return {
    name: i.name,
    default_measurement_type: i.default_measurement_type,
    labels: [...i.labels],
    ...(i.parent_id !== undefined && { parent_id: i.parent_id }),
  };
}

// TODO: Log invalid ingredients instead of silently skipping them
function validate_stored(id: IngredientId, raw: unknown): Ingredient | null {
  const result = StoredIngredient(raw);
  if (is_type_error(result)) return null;
  return {
    kind: "ingredient",
    id,
    name: result.name,
    default_measurement_type: result.default_measurement_type,
    labels: result.labels,
    ...(result.parent_id !== undefined && { parent_id: result.parent_id }),
  };
}

export function get_ingredients(doc: Y.Doc): Ingredient[] {
  const map = get_ingredient_ymap(doc);
  const results: Ingredient[] = [];
  map.forEach((value, id) => {
    const ingredient = validate_stored(load_id(IngredientId, id), value);
    if (ingredient != null) results.push(ingredient);
  });
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export function init_from_kitchenware_templates(
  doc: Y.Doc,
  templates: readonly KitchenwareTemplate[],
): void {
  const ingredient_map = get_ingredient_ymap(doc);
  const labels_map = get_labels_ymap(doc);
  if (ingredient_map.size > 0 || labels_map.size > 0) return;

  // Collect all unique label names across all templates
  const all_label_names = new Set<string>();
  for (const item of templates) {
    for (const label_name of item.label_names) {
      all_label_names.add(label_name);
    }
  }

  doc.transact(() => {
    // Create a label for each unique name and build name → id map
    const label_name_to_id = new Map<string, KitchenwareLabelId>();
    for (const label_name of all_label_names) {
      const id = find_or_create_label(doc, label_name, DEFAULT_INGREDIENT_KINDS);
      label_name_to_id.set(label_name, id);
    }

    // Create each ingredient template as a real Ingredient
    for (const item of templates) {
      if (item.kind !== "ingredient") continue;
      const label_ids = new Set<KitchenwareLabelId>(
        item.label_names
          .map((name) => label_name_to_id.get(name))
          .filter((id): id is KitchenwareLabelId => id != null),
      );
      const ingredient: Ingredient = {
        kind: "ingredient",
        id: load_id(IngredientId, item.id),
        name: item.name,
        default_measurement_type: item.default_measurement_type,
        labels: label_ids,
      };
      ingredient_map.set(ingredient.id, to_stored(ingredient));
    }
  });
}

export function add_ingredient(doc: Y.Doc, ingredient: Ingredient): void {
  get_ingredient_ymap(doc).set(ingredient.id, to_stored(ingredient));
}

export function add_labels_to_ingredients(
  doc: Y.Doc,
  ids: readonly IngredientId[],
  label_ids: readonly KitchenwareLabelId[],
): void {
  const map = get_ingredient_ymap(doc);
  doc.transact(() => {
    for (const id of ids) {
      const ingredient = validate_stored(id, map.get(id));
      if (ingredient === null) continue;
      const new_labels = new Set([...ingredient.labels, ...label_ids]);
      map.set(id, to_stored({ ...ingredient, labels: new_labels }));
    }
  });
}

export function remove_labels_from_ingredients(
  doc: Y.Doc,
  ids: readonly IngredientId[],
  label_ids: readonly KitchenwareLabelId[],
): void {
  const remove_set = new Set<string>(label_ids);
  const map = get_ingredient_ymap(doc);
  doc.transact(() => {
    for (const id of ids) {
      const ingredient = validate_stored(id, map.get(id));
      if (ingredient === null) continue;
      const new_labels = new Set([...ingredient.labels].filter((l) => !remove_set.has(l)));
      if (new_labels.size === ingredient.labels.size) continue;
      map.set(id, to_stored({ ...ingredient, labels: new_labels }));
    }
  });
}

export function remove_label_from_all_ingredients(
  doc: Y.Doc,
  label_id: KitchenwareLabelId,
): void {
  const map = get_ingredient_ymap(doc);
  doc.transact(() => {
    map.forEach((value, id) => {
      const ingredient = validate_stored(load_id(IngredientId, id), value);
      if (ingredient === null) return;
      if (!ingredient.labels.has(label_id)) return;
      const new_labels = new Set(ingredient.labels);
      new_labels.delete(label_id);
      map.set(id, to_stored({ ...ingredient, labels: new_labels }));
    });
  });
}

export function replace_label_in_all_ingredients(
  doc: Y.Doc,
  old_label_ids: readonly KitchenwareLabelId[],
  new_label_id: KitchenwareLabelId,
): void {
  const old_set = new Set<string>(old_label_ids);
  const map = get_ingredient_ymap(doc);
  doc.transact(() => {
    map.forEach((value, id) => {
      const ingredient = validate_stored(load_id(IngredientId, id), value);
      if (ingredient === null) return;
      const has_any_old = [...ingredient.labels].some((l) => old_set.has(l));
      if (!has_any_old) return;
      const new_labels = new Set([...ingredient.labels].filter((l) => !old_set.has(l)));
      new_labels.add(new_label_id);
      map.set(id, to_stored({ ...ingredient, labels: new_labels }));
    });
  });
}

export function set_measurement_type_for_ingredients(
  doc: Y.Doc,
  ids: readonly IngredientId[],
  type: MeasurementType,
): void {
  const map = get_ingredient_ymap(doc);
  doc.transact(() => {
    for (const id of ids) {
      const ingredient = validate_stored(id, map.get(id));
      if (ingredient === null || ingredient.default_measurement_type === type) continue;
      map.set(id, to_stored({ ...ingredient, default_measurement_type: type }));
    }
  });
}

export function set_parent_for_ingredients(
  doc: Y.Doc,
  ids: readonly IngredientId[],
  parent_id: IngredientId | undefined,
): void {
  const map = get_ingredient_ymap(doc);
  doc.transact(() => {
    for (const id of ids) {
      const ingredient = validate_stored(id, map.get(id));
      if (ingredient === null) continue;
      const updated: Ingredient = {
        kind: "ingredient",
        id: ingredient.id,
        name: ingredient.name,
        default_measurement_type: ingredient.default_measurement_type,
        labels: ingredient.labels,
        ...(parent_id !== undefined && { parent_id }),
      };
      map.set(id, to_stored(updated));
    }
  });
}

export function rename_ingredient(
  doc: Y.Doc,
  id: IngredientId,
  name: string,
): void {
  const map = get_ingredient_ymap(doc);
  const ingredient = validate_stored(id, map.get(id));
  if (ingredient === null) return;
  map.set(id, to_stored({ ...ingredient, name }));
}

export function set_labels_for_ingredient(
  doc: Y.Doc,
  id: IngredientId,
  label_ids: readonly KitchenwareLabelId[],
): void {
  const map = get_ingredient_ymap(doc);
  const ingredient = validate_stored(id, map.get(id));
  if (ingredient === null) return;
  map.set(id, to_stored({ ...ingredient, labels: new Set(label_ids) }));
}
