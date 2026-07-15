import { type } from "arktype";
import { Companion, extend } from "./companion.ts";
import { EnumCompanion } from "./enums.ts";
import { IdCompanion } from "./ids.ts";
import { Measurement } from "./measurement.ts";
import { setOf } from "./sets.ts";

// externalized to avoid circular definitions in KitchenwareId
const KitchenwareIdLength = 12 as const;

export type KitchenwareId = Kitchenware["id"];
export const KitchenwareId = extend(IdCompanion("KitchenwareId", KitchenwareIdLength), (self) => {
  return {
    ...self,
    length: KitchenwareIdLength,
  };
});

export const KitchenwareKind = EnumCompanion("KitchenwareKind", [
  "ingredient",
  "container",
  "equipment",
]);
export type KitchenwareKind = typeof KitchenwareKind.type.infer;

export const KitchenwareLabelId = IdCompanion("KitchenwareLabelId", 7);
export type KitchenwareLabelId = typeof KitchenwareLabelId.type.infer;

export const KitchenwareLabel = Companion(
  "KitchenwareLabel",
  type({
    id: KitchenwareLabelId.type,
    name: "string",
    kinds: setOf(KitchenwareKind.type),
  }),
);
export type KitchenwareLabel = typeof KitchenwareLabel.type.infer;

export const IngredientId = IdCompanion("IngredientId", KitchenwareIdLength);
export type IngredientId = typeof IngredientId.type.infer;

export const Ingredient = Companion(
  "Ingredient",
  type({
    kind: "'ingredient'",
    id: IngredientId.type,
    name: "string",
    default_measurement_value: Measurement.type,
    labels: setOf<KitchenwareLabelId>(KitchenwareLabelId.type),
    "parent_id?": IngredientId.type,
  }),
);
export type Ingredient = typeof Ingredient.type.infer;

export const ContainerId = IdCompanion("ContainerId", KitchenwareIdLength);
export type ContainerId = typeof ContainerId.type.infer;

export const Container = Companion(
  "Container",
  type({
    kind: "'container'",
    id: ContainerId.type,
    name: "string",
    labels: setOf<KitchenwareLabelId>(KitchenwareLabelId.type),
    "parent_id?": ContainerId.type,
  }),
);
export type Container = typeof Container.type.infer;

export const EquipmentId = IdCompanion("EquipmentId", KitchenwareIdLength);
export type EquipmentId = typeof EquipmentId.type.infer;

export const Equipment = Companion(
  "Equipment",
  type({
    kind: "'equipment'",
    id: EquipmentId.type,
    name: "string",
    labels: "unknown" as type.cast<ReadonlySet<KitchenwareLabelId>>,
  }),
);
export type Equipment = typeof Equipment.type.infer;

export const Kitchenware = type.or(Ingredient.type, Container.type, Equipment.type);
export type Kitchenware = typeof Kitchenware.infer;

export function isIngredient(item: Kitchenware): item is Ingredient {
  return item.kind === "ingredient";
}

export function isContainer(item: Kitchenware): item is Container {
  return item.kind === "container";
}

export function isEquipment(item: Kitchenware): item is Equipment {
  return item.kind === "equipment";
}
