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
  renameIngredient as renameIngredientInDoc,
  setLabelsForIngredient,
  setMeasurementValueForIngredients,
  setParentForIngredients,
} from "@recipe-book/shared";
import { randomId } from "@recipe-book/shared";
import { useEffect, useState } from "react";
import { useKitchenwareDoc } from "../contexts/docContext.js";

const ingredientKinds: ReadonlySet<KitchenwareKind> = new Set(["ingredient"]);

export interface NewIngredientInput {
  readonly name: string;
  readonly default_measurement_value: Measurement;
  readonly labelNames: readonly string[];
  readonly parent_id?: IngredientId;
}

export interface UseIngredientStoreResult {
  readonly ingredients: readonly Ingredient[];
  readonly createIngredient: (input: NewIngredientInput) => IngredientId;
  readonly renameIngredient: (id: IngredientId, name: string) => void;
  readonly addLabels: (
    ids: readonly IngredientId[],
    label_ids: readonly KitchenwareLabelId[],
  ) => void;
  readonly removeLabels: (
    ids: readonly IngredientId[],
    label_ids: readonly KitchenwareLabelId[],
  ) => void;
  readonly setLabels: (id: IngredientId, label_ids: readonly KitchenwareLabelId[]) => void;
  readonly setMeasurementValue: (ids: readonly IngredientId[], value: Measurement) => void;
  readonly setParent: (ids: readonly IngredientId[], parent_id: IngredientId | undefined) => void;
}

export function useIngredientStore(): UseIngredientStoreResult {
  const { doc, whenSynced } = useKitchenwareDoc();
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => getIngredients(doc));

  // Load defaults from static CSV asset if the store is empty after IndexedDB sync
  useEffect(() => {
    (async function syncIngredientStore() {
      try {
        await whenSynced;
      } catch (e) {
        console.error("failed to sync with server: ", e);
        console.warn("skipping import of default kitchenware...");
        return;
      }
      try {
        const ingredientMap = doc.getMap("ingredients");
        const labelsMap = doc.getMap("labels");
        if (ingredientMap.size > 0 || labelsMap.size > 0) return;

        const r = await fetch("/kitchenware.csv");
        const csv = await r.text();
        const templates = parseKitchenwareCsv(csv);
        initFromKitchenwareTemplates(doc, templates);
        console.debug("server synchronize complete.");
      } catch (e) {
        console.warn("failed to import default kitchenware from server: ", e);
      }
    })();
  }, [doc, whenSynced]);

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
      const label_ids = new Set(
        input.labelNames.map((name) => findOrCreateLabel(doc, name, ingredientKinds)),
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
