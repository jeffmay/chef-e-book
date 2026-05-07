import * as Y from "yjs";
import { nanoid } from "nanoid";
import type { Ingredient, ItemKind } from "../types/item.js";
import type { MeasurementType } from "../types/measurement.js";
import type { ItemLabel } from "../types/item_label.js";
import { DEFAULT_KITCHENWARE } from "../fixtures/default_kitchenware.js";
import { find_or_create_label, get_labels_ymap } from "./label_store.js";

const MAP_KEY = "ingredients";

const DEFAULT_INGREDIENT_KINDS: ReadonlySet<ItemKind> = new Set(["ingredient"]);

export function get_ingredient_ymap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(MAP_KEY);
}

interface StoredIngredient {
  readonly name: string;
  readonly default_measurement_type: MeasurementType;
  readonly labels: string[];
  readonly parent_id?: string;
}

function to_stored(i: Ingredient): StoredIngredient {
  return {
    name: i.name,
    default_measurement_type: i.default_measurement_type,
    labels: [...i.labels],
    ...(i.parent_id !== undefined && { parent_id: i.parent_id }),
  };
}

function validate_stored(id: Ingredient.Id, raw: unknown): Ingredient | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const name = obj["name"];
  const mtype = obj["default_measurement_type"];
  const labels_raw = obj["labels"];
  const parent_id = obj["parent_id"];
  if (typeof name !== "string") return null;
  if (mtype !== "volume" && mtype !== "weight" && mtype !== "count") return null;
  if (!Array.isArray(labels_raw) || !labels_raw.every((l) => typeof l === "string")) return null;
  const labels = new Set(labels_raw as ItemLabel.Id[]);
  const base: Ingredient = {
    kind: "ingredient",
    id,
    name,
    default_measurement_type: mtype,
    labels,
  };
  if (typeof parent_id === "string") return { ...base, parent_id: parent_id as Ingredient.Id };
  return base;
}

export function get_ingredients(doc: Y.Doc): Ingredient[] {
  const map = get_ingredient_ymap(doc);
  const results: Ingredient[] = [];
  map.forEach((value, id) => {
    const ingredient = validate_stored(id as Ingredient.Id, value);
    if (ingredient !== null) results.push(ingredient);
  });
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export function init_ingredients_from_defaults(doc: Y.Doc): void {
  const ingredient_map = get_ingredient_ymap(doc);
  const labels_map = get_labels_ymap(doc);
  if (ingredient_map.size > 0 || labels_map.size > 0) return;

  // Collect all unique label names from the default templates
  const all_label_names = new Set<string>();
  for (const item of DEFAULT_KITCHENWARE) {
    for (const label_name of item.label_names) {
      all_label_names.add(label_name);
    }
  }

  doc.transact(() => {
    // Create a label for each unique name and build name → id map
    const label_name_to_id = new Map<string, ItemLabel.Id>();
    for (const label_name of all_label_names) {
      const id = find_or_create_label(doc, label_name, DEFAULT_INGREDIENT_KINDS);
      label_name_to_id.set(label_name, id);
    }

    // Create each ingredient template as a real Ingredient
    for (const item of DEFAULT_KITCHENWARE) {
      if (item.kind !== "ingredient") continue;
      const label_ids = new Set(
        item.label_names
          .map((n) => label_name_to_id.get(n))
          .filter((id): id is ItemLabel.Id => id !== undefined),
      );
      const ingredient: Ingredient = {
        kind: "ingredient",
        id: item.id as Ingredient.Id,
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
  ids: readonly Ingredient.Id[],
  label_ids: readonly ItemLabel.Id[],
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
  ids: readonly Ingredient.Id[],
  label_ids: readonly ItemLabel.Id[],
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
  label_id: ItemLabel.Id,
): void {
  const map = get_ingredient_ymap(doc);
  doc.transact(() => {
    map.forEach((value, id) => {
      const ingredient = validate_stored(id as Ingredient.Id, value);
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
  old_label_ids: readonly ItemLabel.Id[],
  new_label_id: ItemLabel.Id,
): void {
  const old_set = new Set<string>(old_label_ids);
  const map = get_ingredient_ymap(doc);
  doc.transact(() => {
    map.forEach((value, id) => {
      const ingredient = validate_stored(id as Ingredient.Id, value);
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
  ids: readonly Ingredient.Id[],
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
  ids: readonly Ingredient.Id[],
  parent_id: Ingredient.Id | undefined,
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
  id: Ingredient.Id,
  name: string,
): void {
  const map = get_ingredient_ymap(doc);
  const ingredient = validate_stored(id, map.get(id));
  if (ingredient === null) return;
  map.set(id, to_stored({ ...ingredient, name }));
}

export function set_labels_for_ingredient(
  doc: Y.Doc,
  id: Ingredient.Id,
  label_ids: readonly ItemLabel.Id[],
): void {
  const map = get_ingredient_ymap(doc);
  const ingredient = validate_stored(id, map.get(id));
  if (ingredient === null) return;
  map.set(id, to_stored({ ...ingredient, labels: new Set(label_ids) }));
}

export function make_ingredient_id(): Ingredient.Id {
  return nanoid(12) as Ingredient.Id;
}
