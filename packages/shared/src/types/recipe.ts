import { type } from "arktype";
import { AnyCompanion, Companion, ScopedCompanion } from "./companion.js";
import { EnumCompanion } from "./enums.js";
import { IdCompanion } from "./ids.js";
import { ContainerId, EquipmentId, IngredientId } from "./kitchenware.js";
import { Measurement } from "./measurement.js";
import { RecipeFolderId } from "./recipeGroup.js";

export const RecipeId = IdCompanion("RecipeId", 12);
export type RecipeId = typeof RecipeId.type.infer;

export const SectionItemId = IdCompanion("SectionItemId", 12);
export type SectionItemId = typeof SectionItemId.type.infer;

export const RecipeIngredientId = IdCompanion("RecipeIngredientId", 12);
export type RecipeIngredientId = typeof RecipeIngredientId.type.infer;

export const RecipeIngredient = Companion(
  "RecipeIngredient",
  type({
    id: RecipeIngredientId.type,
    ingredient_id: IngredientId.type,
    "amount?": Measurement.type,
  }),
);
export type RecipeIngredient = typeof RecipeIngredient.type.infer;

// Use scope syntax to allow recursive definitions
const section = type
  .scope({
    "#BaseSectionItem": {
      id: () => SectionItemId.type,
      "notes?": "string[]",
    },
    IngredientItem: {
      "...": "BaseSectionItem",
      kind: "'ingredient'",
      ingredient_id: IngredientId.type,
      "amount?": Measurement.type,
    },
    ContainerItem: {
      "...": "BaseSectionItem",
      kind: "'container'",
      container_id: ContainerId.type,
      descriptor: "string",
      "ordered?": "boolean",
      contents: "IngredientItem[]",
    },
    TextBlock: {
      "...": "BaseSectionItem",
      kind: "'text_block'",
      text: "string",
    },
    Instruction: {
      "...": "BaseSectionItem",
      kind: "'instruction'",
      instruction: "string", // ex: chop, mix, blend, stir, bake, fry, etc...
      "equipment_id?": () => EquipmentId.type,
      "ingredient_ids?": () => IngredientId.type.array(),
      "duration_seconds?": "number",
    },
    Section: {
      "...": "BaseSectionItem",
      kind: "'section'",
      "header?": "string",
      contents: "SectionItem[]",
    },
    SectionItem: "IngredientItem | ContainerItem | TextBlock | Instruction | Section",
  })
  .export();

export const SectionItemKind = EnumCompanion("SectionItemKind", [
  "ingredient",
  "container",
  "text_block",
  "instruction",
  "section",
]) satisfies AnyCompanion<SectionItem["kind"]>;
export type SectionItemKind = typeof SectionItemKind.type.infer;

export const IngredientItem = ScopedCompanion(section, "IngredientItem");
export type IngredientItem = typeof section.IngredientItem.infer;

export const ContainerItem = ScopedCompanion(section, "ContainerItem");
export type ContainerItem = typeof section.ContainerItem.infer;

export const TextBlock = ScopedCompanion(section, "TextBlock");
export type TextBlock = typeof section.TextBlock.infer;

export const Instruction = ScopedCompanion(section, "Instruction");
export type Instruction = typeof section.Instruction.infer;

export const Section = ScopedCompanion(section, "Section");
export type Section = typeof section.Section.infer;

export const SectionItem = ScopedCompanion(section, "SectionItem") satisfies AnyCompanion<{
  kind: SectionItemKind;
}>;
export type SectionItem = typeof section.SectionItem.infer;

export const RecipeVersionId = IdCompanion("RecipeVersionId", 12);
export type RecipeVersionId = typeof RecipeVersionId.type.infer;

export const RecipeVersion = Companion(
  "RecipeVersion",
  type({
    id: RecipeVersionId.type,
    recipe_id: RecipeId.type,
    description: "string",
    ingredients: RecipeIngredient.type.array(),
    sections: Section.type.array(),
    created_at: "number",
    // created_by: "string",
  }),
);
export type RecipeVersion = typeof RecipeVersion.type.infer;

export const Recipe = Companion(
  "Recipe",
  type({
    id: RecipeId.type,
    title: "string",
    "subtitle?": "string",
    "source_url?": "string.url",
    "parent_folder_id?": RecipeFolderId.type,
    versions: RecipeVersion.type.array(),
    created_at: "number",
    updated_at: "number",
  }),
);
export type Recipe = typeof Recipe.type.infer;

export function isIngredientItem(item: SectionItem): item is IngredientItem {
  return item.kind === "ingredient";
}

export function isContainerItem(item: SectionItem): item is ContainerItem {
  return item.kind === "container";
}

export function isTextBlock(item: SectionItem): item is TextBlock {
  return item.kind === "text_block";
}

export function isInstruction(item: SectionItem): item is Instruction {
  return item.kind === "instruction";
}

export function isSection(item: SectionItem): item is Section {
  return item.kind === "section";
}
