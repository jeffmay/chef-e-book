import type { Ingredient, KitchenwareKind, KitchenwareLabelId } from "@recipe-book/shared";
import {
  addIngredient,
  addLabelsToIngredients,
  findOrCreateLabel,
  getIngredients,
  IngredientId,
  type Measurement,
  randomId,
  removeLabelsFromIngredients,
  renameIngredient as renameIngredientInDoc,
  setLabelsForIngredient,
  setMeasurementValueForIngredients,
  setParentForIngredients,
} from "@recipe-book/shared";
import { useEffect, useState } from "react";
import type { ReadonlyDeep } from "type-fest";
import { useBookDoc } from "../contexts/docContext.ts";

const ingredientKinds: ReadonlySet<KitchenwareKind> = new Set(["ingredient"]);

export type NewIngredientInput = {
  name: string;
  default_measurement_value: Measurement;
  label_names: string[];
  parent_id?: IngredientId;
};

export interface IngredientStore {
  ingredients: Ingredient[];
  createIngredient: (input: ReadonlyDeep<NewIngredientInput>) => IngredientId;
  renameIngredient: (id: IngredientId, name: string) => void;
  addLabels: (ids: readonly IngredientId[], labelIds: readonly KitchenwareLabelId[]) => void;
  removeLabels: (ids: readonly IngredientId[], labelIds: readonly KitchenwareLabelId[]) => void;
  setLabels: (id: IngredientId, labelIds: readonly KitchenwareLabelId[]) => void;
  setMeasurementValue: (ids: readonly IngredientId[], value: Measurement) => void;
  setParent: (ids: readonly IngredientId[], parent_id: IngredientId | undefined) => void;
}

export function useIngredientStore(): IngredientStore {
  const { doc, whenSynced } = useBookDoc();
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => getIngredients(doc));

  useEffect(() => {
    const map = doc.getMap("ingredients");
    const handler = () => setIngredients(getIngredients(doc));
    map.observe(handler);
    // Refresh ingredients once IndexedDB has finished loading existing data
    whenSynced.then(() => setIngredients(getIngredients(doc)));
    return () => map.unobserve(handler);
  }, [doc, whenSynced]);

  return {
    ingredients,
    createIngredient(input) {
      const id = randomId(IngredientId);
      // Creating any missing labels and the ingredient itself is one action, so one undo step.
      doc.transact(() => {
        const labelIds = new Set(
          input.label_names.map((name) => findOrCreateLabel(doc, name, ingredientKinds)),
        );
        const ingredient: Ingredient = {
          kind: "ingredient",
          id,
          name: input.name,
          default_measurement_value: input.default_measurement_value,
          labels: labelIds,
          ...(input.parent_id && { parent_id: input.parent_id }),
        };
        addIngredient(doc, ingredient);
      });
      return id;
    },
    renameIngredient(id, name) {
      renameIngredientInDoc(doc, id, name);
    },
    addLabels(ids, label_ids) {
      addLabelsToIngredients(doc, ids, label_ids);
    },
    removeLabels(ids, label_ids) {
      removeLabelsFromIngredients(doc, ids, label_ids);
    },
    setLabels(id, label_ids) {
      setLabelsForIngredient(doc, id, label_ids);
    },
    setMeasurementValue(ids, value) {
      setMeasurementValueForIngredients(doc, ids, value);
    },
    setParent(ids, parent_id) {
      setParentForIngredients(doc, ids, parent_id);
    },
  };
}
