import { type } from "arktype";
import type * as Y from "yjs";
import type { KitchenwareTemplate } from "../fixtures/kitchenware.ts";
import { Companion } from "../types/companion.ts";
import { loadId } from "../types/ids.ts";
import type { Ingredient, KitchenwareKind } from "../types/kitchenware.ts";
import { IngredientId, KitchenwareLabelId } from "../types/kitchenware.ts";
import type { MeasurementType } from "../types/measurement.ts";
import { Measurement } from "../types/measurement.ts";
import { setOf } from "../types/sets.ts";
import { findOrCreateLabel, getLabelsYmap } from "./labelStore.ts";
import type { ValidationError } from "./validation.ts";
import { isInvalid, isValid, validateByIdOrLog } from "./validation.ts";

const MAP_KEY = "ingredients";

const DEFAULT_INGREDIENT_KINDS: ReadonlySet<KitchenwareKind> = new Set(["ingredient"]);

const DEFAULT_MEASUREMENT_BY_TYPE: Record<MeasurementType, Measurement> = {
  volume: { value: { numerator: 1, denominator: 1 }, unit: "cup" },
  weight: { value: { numerator: 1, denominator: 1 }, unit: "oz" },
  count: { value: { numerator: 1, denominator: 1 }, unit: "whole" },
};

export function getIngredientYmap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(MAP_KEY);
}

const StoredIngredient = Companion(
  "StoredIngredient",
  type({
    name: "string",
    default_measurement_value: Measurement.type,
    labels: setOf<KitchenwareLabelId>(KitchenwareLabelId.type),
    "parent_id?": IngredientId.type,
  }),
);

function toStored(i: Ingredient) {
  return {
    name: i.name,
    default_measurement_value: {
      value: {
        numerator: i.default_measurement_value.value.numerator,
        denominator: i.default_measurement_value.value.denominator,
      },
      unit: i.default_measurement_value.unit,
    },
    labels: [...i.labels],
    ...(i.parent_id !== undefined && { parent_id: i.parent_id }),
  };
}

function validateStoredOrLog(id: IngredientId, raw: unknown): Ingredient | ValidationError {
  const result = validateByIdOrLog(StoredIngredient, id, raw, { dataFrom: "localstorage" });
  if (isInvalid(result)) return result;
  return {
    kind: "ingredient",
    id,
    name: result.name,
    default_measurement_value: {
      value: {
        numerator: result.default_measurement_value.value.numerator,
        denominator: result.default_measurement_value.value.denominator,
      },
      unit: result.default_measurement_value.unit,
    },
    labels: result.labels,
    ...(result.parent_id !== undefined && { parent_id: result.parent_id }),
  };
}

export function getIngredients(doc: Y.Doc): Ingredient[] {
  const map = getIngredientYmap(doc);
  const results: Ingredient[] = [];
  map.forEach((value, id) => {
    const ingredient = validateStoredOrLog(loadId(IngredientId, id), value);
    if (isValid(ingredient)) results.push(ingredient);
  });
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export function initFromKitchenwareTemplates(
  doc: Y.Doc,
  templates: readonly KitchenwareTemplate[],
): void {
  const ingredientMap = getIngredientYmap(doc);
  const labelsMap = getLabelsYmap(doc);
  if (ingredientMap.size > 0 || labelsMap.size > 0) return;

  const allLabelNames = new Set<string>();
  for (const item of templates) {
    for (const labelName of item.label_names) {
      allLabelNames.add(labelName);
    }
  }

  doc.transact(() => {
    const labelNameToId = new Map<string, KitchenwareLabelId>();
    for (const labelName of allLabelNames) {
      const id = findOrCreateLabel(doc, labelName, DEFAULT_INGREDIENT_KINDS);
      labelNameToId.set(labelName, id);
    }

    for (const item of templates) {
      if (item.kind !== "ingredient") continue;
      const labelIds = new Set<KitchenwareLabelId>(
        item.label_names
          .map((name) => labelNameToId.get(name))
          .filter((id): id is KitchenwareLabelId => id != null),
      );
      const ingredient: Ingredient = {
        kind: "ingredient",
        id: loadId(IngredientId, item.id),
        name: item.name,
        default_measurement_value: DEFAULT_MEASUREMENT_BY_TYPE[item.default_measurement_type],
        labels: labelIds,
      };
      ingredientMap.set(ingredient.id, toStored(ingredient));
    }
  });
}

export function addIngredient(doc: Y.Doc, ingredient: Ingredient): void {
  getIngredientYmap(doc).set(ingredient.id, toStored(ingredient));
}

export function addLabelsToIngredients(
  doc: Y.Doc,
  ids: readonly IngredientId[],
  labelIds: readonly KitchenwareLabelId[],
): void {
  const map = getIngredientYmap(doc);
  doc.transact(() => {
    for (const id of ids) {
      const ingredient = validateStoredOrLog(id, map.get(id));
      if (isInvalid(ingredient)) continue;
      const newLabels = new Set([...ingredient.labels, ...labelIds]);
      map.set(id, toStored({ ...ingredient, labels: newLabels }));
    }
  });
}

export function removeLabelsFromIngredients(
  doc: Y.Doc,
  ids: readonly IngredientId[],
  labelIds: readonly KitchenwareLabelId[],
): void {
  const removeSet = new Set<string>(labelIds);
  const map = getIngredientYmap(doc);
  doc.transact(() => {
    for (const id of ids) {
      const ingredient = validateStoredOrLog(id, map.get(id));
      if (isInvalid(ingredient)) continue;
      const newLabels = new Set([...ingredient.labels].filter((l) => !removeSet.has(l)));
      if (newLabels.size === ingredient.labels.size) continue;
      map.set(id, toStored({ ...ingredient, labels: newLabels }));
    }
  });
}

export function removeLabelFromAllIngredients(doc: Y.Doc, labelId: KitchenwareLabelId): void {
  const map = getIngredientYmap(doc);
  doc.transact(() => {
    map.forEach((value, id) => {
      const ingredient = validateStoredOrLog(loadId(IngredientId, id), value);
      if (isInvalid(ingredient)) return;
      if (!ingredient.labels.has(labelId)) return;
      const newLabels = new Set(ingredient.labels);
      newLabels.delete(labelId);
      map.set(id, toStored({ ...ingredient, labels: newLabels }));
    });
  });
}

export function replaceLabelInAllIngredients(
  doc: Y.Doc,
  oldLabelIds: readonly KitchenwareLabelId[],
  newLabelId: KitchenwareLabelId,
): void {
  const oldSet = new Set<string>(oldLabelIds);
  const map = getIngredientYmap(doc);
  doc.transact(() => {
    map.forEach((value, id) => {
      const ingredient = validateStoredOrLog(loadId(IngredientId, id), value);
      if (isInvalid(ingredient)) return;
      const hasAnyOld = [...ingredient.labels].some((l) => oldSet.has(l));
      if (!hasAnyOld) return;
      const newLabels = new Set([...ingredient.labels].filter((l) => !oldSet.has(l)));
      newLabels.add(newLabelId);
      map.set(id, toStored({ ...ingredient, labels: newLabels }));
    });
  });
}

export function setMeasurementValueForIngredients(
  doc: Y.Doc,
  ids: readonly IngredientId[],
  value: Measurement,
): void {
  const map = getIngredientYmap(doc);
  doc.transact(() => {
    for (const id of ids) {
      const ingredient = validateStoredOrLog(id, map.get(id));
      if (isInvalid(ingredient)) continue;
      map.set(id, toStored({ ...ingredient, default_measurement_value: value }));
    }
  });
}

export function setParentForIngredients(
  doc: Y.Doc,
  ids: readonly IngredientId[],
  parentId: IngredientId | undefined,
): void {
  const map = getIngredientYmap(doc);
  doc.transact(() => {
    for (const id of ids) {
      const ingredient = validateStoredOrLog(id, map.get(id));
      if (isInvalid(ingredient)) continue;
      const updated: Ingredient = {
        kind: "ingredient",
        id: ingredient.id,
        name: ingredient.name,
        default_measurement_value: ingredient.default_measurement_value,
        labels: ingredient.labels,
        ...(parentId !== undefined && { parent_id: parentId }),
      };
      map.set(id, toStored(updated));
    }
  });
}

export function renameIngredient(doc: Y.Doc, id: IngredientId, name: string): void {
  const map = getIngredientYmap(doc);
  const ingredient = validateStoredOrLog(id, map.get(id));
  if (isInvalid(ingredient)) return;
  map.set(id, toStored({ ...ingredient, name }));
}

export function setLabelsForIngredient(
  doc: Y.Doc,
  id: IngredientId,
  labelIds: readonly KitchenwareLabelId[],
): void {
  const map = getIngredientYmap(doc);
  const ingredient = validateStoredOrLog(id, map.get(id));
  if (isInvalid(ingredient)) return;
  map.set(id, toStored({ ...ingredient, labels: new Set(labelIds) }));
}
