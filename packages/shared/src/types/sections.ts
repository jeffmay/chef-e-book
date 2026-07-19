import type { ReadonlyDeep } from "type-fest";
import { randomId } from "./ids.ts";
import type { IngredientId } from "./kitchenware.ts";
import {
  type IngredientItem,
  type Instruction,
  type RecipeIngredient,
  RecipeIngredientId,
  type Section,
  type SectionItem,
  type SectionItemId,
} from "./recipe.ts";

/**
 * Collects all IngredientItems from sections in document order, including
 * those nested inside containers and sub-sections.
 */
export function collectIngredientItems(
  sections: ReadonlyDeep<Section[]>,
): ReadonlyDeep<IngredientItem>[] {
  const items: ReadonlyDeep<IngredientItem>[] = [];

  function walk(contents: ReadonlyDeep<SectionItem[]>) {
    for (const item of contents) {
      if (item.kind === "ingredient") {
        items.push(item);
      } else if (item.kind === "container") {
        items.push(...item.contents);
      } else if (item.kind === "section") {
        walk(item.contents);
      }
    }
  }

  for (const section of sections) {
    walk(section.contents);
  }

  return items;
}

/**
 * Collects all Instructions from sections in document order, including those
 * nested inside sub-sections.
 */
export function collectInstructions(
  sections: ReadonlyDeep<Section[]>,
): ReadonlyDeep<Instruction>[] {
  const items: ReadonlyDeep<Instruction>[] = [];

  function walk(contents: ReadonlyDeep<SectionItem[]>) {
    for (const item of contents) {
      if (item.kind === "instruction") {
        items.push(item);
      } else if (item.kind === "section") {
        walk(item.contents);
      }
    }
  }

  for (const section of sections) {
    walk(section.contents);
  }

  return items;
}

/**
 * Computes the top-level RecipeIngredient[] from sections (for saving a
 * RecipeVersion): one entry per distinct ingredient, keeping the first
 * custom amount encountered.
 */
export function computeTopIngredients(sections: ReadonlyDeep<Section[]>): RecipeIngredient[] {
  const items = collectIngredientItems(sections);
  const seen = new Set<IngredientId>();
  const result: RecipeIngredient[] = [];

  for (const item of items) {
    if (!seen.has(item.ingredient_id)) {
      seen.add(item.ingredient_id);
      result.push({
        id: randomId(RecipeIngredientId),
        ingredient_id: item.ingredient_id,
        ...(item.customAmount && { amount: item.customAmount }),
      });
    }
  }

  return result;
}

/**
 * Returns a deep copy of the sections with every item whose id appears in
 * `removed_ids` filtered out (recursing into containers and sub-sections).
 * A container or sub-section whose own id is in the set is removed along
 * with its contents.
 */
export function removeSectionItemsById<S extends ReadonlyDeep<Section>>(
  sections: readonly S[],
  removedIds: ReadonlySet<SectionItemId>,
  removeEmptyContainers?: boolean,
): S[] {
  function filterContents(contents: ReadonlyDeep<SectionItem[]>): ReadonlyDeep<SectionItem>[] {
    const result: ReadonlyDeep<SectionItem>[] = [];
    for (const item of contents) {
      if (removedIds.has(item.id)) continue;
      if (item.kind === "container") {
        const contents = item.contents.filter((c) => !removedIds.has(c.id));
        if (removeEmptyContainers !== true) {
          result.push({ ...item, contents });
        }
      } else if (item.kind === "section") {
        const contents = filterContents(item.contents);
        if (removeEmptyContainers !== true) {
          result.push({ ...item, contents });
        }
      } else {
        result.push(item);
      }
    }
    return result;
  }

  return sections
    .filter((s) => !removedIds.has(s.id))
    .map((s) => ({ ...s, contents: filterContents(s.contents) }));
}
