import { useState, useEffect } from "react";
import type { Ingredient, ItemKind } from "@recipe-book/shared";
import type { MeasurementType } from "@recipe-book/shared";
import type { ItemLabel } from "@recipe-book/shared";
import {
  get_ingredients,
  init_ingredients_from_defaults,
  add_ingredient,
  add_labels_to_ingredients,
  remove_labels_from_ingredients,
  set_measurement_type_for_ingredients,
  set_parent_for_ingredients,
  rename_ingredient as rename_ingredient_in_doc,
  set_labels_for_ingredient,
  make_ingredient_id,
  find_or_create_label,
} from "@recipe-book/shared";
import { use_doc } from "../contexts/doc_context.js";

const INGREDIENT_KINDS: ReadonlySet<ItemKind> = new Set(["ingredient"]);

export interface NewIngredientInput {
  readonly name: string;
  readonly default_measurement_type: MeasurementType;
  readonly label_names: readonly string[];
  readonly parent_id?: Ingredient.Id;
}

export interface UseIngredientStoreResult {
  readonly ingredients: readonly Ingredient[];
  readonly create_ingredient: (input: NewIngredientInput) => Ingredient.Id;
  readonly rename_ingredient: (id: Ingredient.Id, name: string) => void;
  readonly add_labels: (ids: readonly Ingredient.Id[], label_ids: readonly ItemLabel.Id[]) => void;
  readonly remove_labels: (
    ids: readonly Ingredient.Id[],
    label_ids: readonly ItemLabel.Id[],
  ) => void;
  readonly set_labels: (id: Ingredient.Id, label_ids: readonly ItemLabel.Id[]) => void;
  readonly set_measurement_type: (ids: readonly Ingredient.Id[], type: MeasurementType) => void;
  readonly set_parent: (ids: readonly Ingredient.Id[], parent_id: Ingredient.Id | undefined) => void;
}

export function use_ingredient_store(): UseIngredientStoreResult {
  const doc = use_doc();
  const [ingredients, set_ingredients] = useState<Ingredient[]>(() => {
    init_ingredients_from_defaults(doc);
    return get_ingredients(doc);
  });

  useEffect(() => {
    const map = doc.getMap("ingredients");
    const handler = () => set_ingredients(get_ingredients(doc));
    map.observe(handler);
    return () => map.unobserve(handler);
  }, [doc]);

  return {
    ingredients,
    create_ingredient(input) {
      const id = make_ingredient_id();
      // Resolve label names to IDs, creating new labels as needed
      const label_ids = new Set(
        input.label_names.map((name) => find_or_create_label(doc, name, INGREDIENT_KINDS)),
      );
      const ingredient: Ingredient = {
        kind: "ingredient",
        id,
        name: input.name,
        default_measurement_type: input.default_measurement_type,
        labels: label_ids,
        ...(input.parent_id !== undefined && { parent_id: input.parent_id }),
      };
      add_ingredient(doc, ingredient);
      return id;
    },
    rename_ingredient(id, name) {
      rename_ingredient_in_doc(doc, id, name);
    },
    add_labels(ids, label_ids) {
      add_labels_to_ingredients(doc, ids, label_ids);
    },
    remove_labels(ids, label_ids) {
      remove_labels_from_ingredients(doc, ids, label_ids);
    },
    set_labels(id, label_ids) {
      set_labels_for_ingredient(doc, id, label_ids);
    },
    set_measurement_type(ids, type) {
      set_measurement_type_for_ingredients(doc, ids, type);
    },
    set_parent(ids, parent_id) {
      set_parent_for_ingredients(doc, ids, parent_id);
    },
  };
}
