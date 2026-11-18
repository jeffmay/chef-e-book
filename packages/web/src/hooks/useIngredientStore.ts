import type { Ingredient, KitchenwareKind, KitchenwareLabelId } from "@recipe-book/shared";
import {
  addIngredient,
  addLabelsToIngredients,
  buildNameIndex,
  duplicateIds,
  findIngredientNameClash,
  findOrCreateLabel,
  getIngredients,
  IngredientId,
  ingredientNameKey,
  type Measurement,
  type NameClash,
  NameClashError,
  randomId,
  removeLabelsFromIngredients,
  renameIngredient as renameIngredientInDoc,
  setLabelsForIngredient,
  setMeasurementValueForIngredients,
  setParentForIngredients,
} from "@recipe-book/shared";
import { useEffect, useMemo, useState } from "react";
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
  /**
   * The ingredient that already holds `name` — as singular or plural, in any case — or `undefined`
   * if it is free. Pass the ingredient's own id when renaming it: it never clashes with itself.
   */
  nameClash: (name: string, excludeId?: IngredientId) => NameClash<IngredientId> | undefined;
  /** Ingredients that share a name with another (older data, or edits made on two devices). */
  duplicateIds: ReadonlySet<IngredientId>;
  /** @throws NameClashError if another ingredient already holds the name. */
  createIngredient: (input: ReadonlyDeep<NewIngredientInput>) => IngredientId;
  /** @throws NameClashError if another ingredient already holds the name. */
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

  const duplicates = useMemo(
    () =>
      duplicateIds(
        buildNameIndex(ingredients.map((i) => ({ id: i.id, key: ingredientNameKey(i.name) }))),
      ),
    [ingredients],
  );

  return {
    ingredients,
    nameClash: (name, excludeId) => findIngredientNameClash(doc, name, excludeId),
    duplicateIds: duplicates,
    createIngredient(input) {
      const clash = findIngredientNameClash(doc, input.name);
      if (clash !== undefined) throw new NameClashError("ingredient", clash);
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
      const clash = findIngredientNameClash(doc, name, id);
      if (clash !== undefined) throw new NameClashError("ingredient", clash);
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
