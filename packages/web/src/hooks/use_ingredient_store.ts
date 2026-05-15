import {
  addIngredient,
  addLabelsToIngredients,
  findOrCreateLabel,
  getIngredients,
  Ingredient,
  IngredientId,
  initFromKitchenwareTemplates,
  KitchenwareKind,
  KitchenwareLabelId,
  type Measurement,
  parseKitchenwareCsv,
  removeLabelsFromIngredients,
  renameIngredient as rename_ingredient_in_doc,
  setLabelsForIngredient,
  setMeasurementValueForIngredients,
  setParentForIngredients,
} from "@recipe-book/shared";
import { randomId } from "@recipe-book/shared";
import { useEffect, useState } from "react";
import { useDoc } from "../contexts/doc_context.js";

const INGREDIENT_KINDS: ReadonlySet<KitchenwareKind> = new Set(["ingredient"]);

export interface NewIngredientInput {
  readonly name: string;
  readonly default_measurement_value: Measurement;
  readonly label_names: readonly string[];
  readonly parent_id?: IngredientId;
}

export interface UseIngredientStoreResult {
  readonly ingredients: readonly Ingredient[];
  readonly create_ingredient: (input: NewIngredientInput) => IngredientId;
  readonly renameIngredient: (id: IngredientId, name: string) => void;
  readonly add_labels: (ids: readonly IngredientId[], label_ids: readonly KitchenwareLabelId[]) => void;
  readonly remove_labels: (
    ids: readonly IngredientId[],
    label_ids: readonly KitchenwareLabelId[],
  ) => void;
  readonly set_labels: (id: IngredientId, label_ids: readonly KitchenwareLabelId[]) => void;
  readonly set_measurement_value: (ids: readonly IngredientId[], value: Measurement) => void;
  readonly set_parent: (ids: readonly IngredientId[], parent_id: IngredientId | undefined) => void;
}

export function useIngredientStore(): UseIngredientStoreResult {
  const doc = useDoc();
  const [ingredients, set_ingredients] = useState<Ingredient[]>(() => getIngredients(doc));

  // Load defaults from static CSV asset if the store is empty
  useEffect(() => {
    const ingredient_map = doc.getMap("ingredients");
    const labels_map = doc.getMap("labels");
    if (ingredient_map.size > 0 || labels_map.size > 0) return;

    fetch("/kitchenware.csv")
      .then((r) => r.text())
      .then((csv) => {
        const templates = parseKitchenwareCsv(csv);
        initFromKitchenwareTemplates(doc, templates);
      })
      .catch((err) => console.error("Failed to load default kitchenware:", err));
  }, [doc]);

  useEffect(() => {
    const map = doc.getMap("ingredients");
    const handler = () => set_ingredients(getIngredients(doc));
    map.observe(handler);
    return () => map.unobserve(handler);
  }, [doc]);

  return {
    ingredients,
    create_ingredient(input) {
      const id = randomId(IngredientId);
      const label_ids = new Set(
        input.label_names.map((name) => findOrCreateLabel(doc, name, INGREDIENT_KINDS)),
      );
      const ingredient: Ingredient = {
        kind: "ingredient",
        id,
        name: input.name,
        default_measurement_value: input.default_measurement_value,
        labels: label_ids,
        ...(input.parent_id !== undefined && { parent_id: input.parent_id }),
      };
      addIngredient(doc, ingredient);
      return id;
    },
    renameIngredient(id, name) {
      rename_ingredient_in_doc(doc, id, name);
    },
    add_labels(ids, label_ids) {
      addLabelsToIngredients(doc, ids, label_ids);
    },
    remove_labels(ids, label_ids) {
      removeLabelsFromIngredients(doc, ids, label_ids);
    },
    set_labels(id, label_ids) {
      setLabelsForIngredient(doc, id, label_ids);
    },
    set_measurement_value(ids, value) {
      setMeasurementValueForIngredients(doc, ids, value);
    },
    set_parent(ids, parent_id) {
      setParentForIngredients(doc, ids, parent_id);
    },
  };
}
