import type { Brand } from "ts-brand";
import type { MeasurementType } from "./measurement.js";
import type { ItemLabel } from "./item_label.js";

export type ItemKind = "ingredient" | "container" | "equipment";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Ingredient {
  export type Id = Brand<string, "Ingredient.Id">;
}
export interface Ingredient {
  readonly kind: "ingredient";
  readonly id: Ingredient.Id;
  readonly name: string;
  readonly default_measurement_type: MeasurementType;
  readonly labels: ReadonlySet<ItemLabel.Id>;
  readonly parent_id?: Ingredient.Id;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Container {
  export type Id = Brand<string, "Container.Id">;
}
export interface Container {
  readonly kind: "container";
  readonly id: Container.Id;
  readonly name: string;
  readonly labels: ReadonlySet<ItemLabel.Id>;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Equipment {
  export type Id = Brand<string, "Equipment.Id">;
}
export interface Equipment {
  readonly kind: "equipment";
  readonly id: Equipment.Id;
  readonly name: string;
  readonly labels: ReadonlySet<ItemLabel.Id>;
}

export type Item = Ingredient | Container | Equipment;
export type ItemId = Ingredient.Id | Container.Id | Equipment.Id;

export function is_ingredient(item: Item): item is Ingredient {
  return item.kind === "ingredient";
}

export function is_container(item: Item): item is Container {
  return item.kind === "container";
}

export function is_equipment(item: Item): item is Equipment {
  return item.kind === "equipment";
}
