import type { ReadonlyDeep } from "type-fest";
import { randomId } from "./ids.ts";
import type { ContainerId, IngredientId } from "./kitchenware.ts";
import type { Measurement } from "./measurement.ts";
import {
  type IngredientItem,
  type Instruction,
  type RecipeIngredient,
  RecipeIngredientId,
  type RecipeVersion,
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

/**
 * Returns a copy of the sections with every item whose id appears in `updates`
 * replaced by its updated value (recursing into sub-sections). Container
 * contents are not walked because only whole containers (never their nested
 * ingredients) are replaced this way.
 *
 * Applying every pending row edit in a single pass keeps concurrent edits from
 * clobbering each other, which is what happens when each row commits its own
 * copy of the section tree.
 */
export function applySectionItemUpdates<S extends ReadonlyDeep<Section>>(
  sections: readonly S[],
  updates: ReadonlyMap<SectionItemId, ReadonlyDeep<SectionItem>>,
): S[] {
  function updateContents(contents: ReadonlyDeep<SectionItem[]>): ReadonlyDeep<SectionItem>[] {
    return contents.map((item) => {
      const updated = updates.get(item.id);
      if (updated !== undefined) return updated;
      if (item.kind === "section") return { ...item, contents: updateContents(item.contents) };
      return item;
    });
  }

  if (updates.size === 0) return [...sections];
  return sections.map((s) => ({ ...s, contents: updateContents(s.contents) }));
}

/** How `remapVersionReferences` rewrites the ids a version points at. */
export type ReferenceRemap = {
  readonly ingredient: (id: IngredientId) => IngredientId;
  readonly container: (id: ContainerId) => ContainerId;
};

function copyMeasurement(m: ReadonlyDeep<Measurement>): Measurement {
  return {
    value: { numerator: m.value.numerator, denominator: m.value.denominator },
    unit: m.unit,
  };
}

function copyNotes(item: ReadonlyDeep<{ notes?: string[] }>): { notes?: string[] } {
  return item.notes === undefined ? {} : { notes: [...item.notes] };
}

/**
 * A deep copy of a version with every ingredient and container id it refers to rewritten through
 * `remap`: its ingredient list, ingredient rows (also inside containers and sub-sections), the
 * ingredients its instructions act on, and its container items. Equipment ids and the version's
 * own ids are left alone. When two ingredients collapse onto one, the ingredient list keeps the
 * first (the first custom amount wins). The copy shares no structure with the input.
 */
export function remapVersionReferences(
  version: ReadonlyDeep<RecipeVersion>,
  remap: ReferenceRemap,
): RecipeVersion {
  function remapIngredientItem(item: ReadonlyDeep<IngredientItem>): IngredientItem {
    return {
      kind: "ingredient",
      id: item.id,
      ingredient_id: remap.ingredient(item.ingredient_id),
      ...(item.customAmount !== undefined && { customAmount: copyMeasurement(item.customAmount) }),
      ...copyNotes(item),
    };
  }

  function remapItem(item: ReadonlyDeep<SectionItem>): SectionItem {
    switch (item.kind) {
      case "ingredient":
        return remapIngredientItem(item);
      case "container":
        return {
          kind: "container",
          id: item.id,
          container_id: remap.container(item.container_id),
          descriptor: item.descriptor,
          ...(item.ordered !== undefined && { ordered: item.ordered }),
          contents: item.contents.map(remapIngredientItem),
          ...copyNotes(item),
        };
      case "instruction":
        return {
          kind: "instruction",
          id: item.id,
          instruction: item.instruction,
          ...(item.equipment_id !== undefined && { equipment_id: item.equipment_id }),
          ...(item.ingredient_ids !== undefined && {
            ingredient_ids: item.ingredient_ids.map((id) => remap.ingredient(id)),
          }),
          ...(item.duration_seconds !== undefined && { duration_seconds: item.duration_seconds }),
          ...copyNotes(item),
        };
      case "section":
        return remapSection(item);
      case "text_block":
        return { kind: "text_block", id: item.id, text: item.text, ...copyNotes(item) };
    }
  }

  function remapSection(section: ReadonlyDeep<Section>): Section {
    return {
      kind: "section",
      id: section.id,
      ...(section.header !== undefined && { header: section.header }),
      contents: section.contents.map(remapItem),
      ...copyNotes(section),
    };
  }

  const seen = new Set<IngredientId>();
  const ingredients: RecipeIngredient[] = [];
  for (const row of version.ingredients) {
    const ingredient_id = remap.ingredient(row.ingredient_id);
    if (seen.has(ingredient_id)) continue;
    seen.add(ingredient_id);
    ingredients.push({
      id: row.id,
      ingredient_id,
      ...(row.amount !== undefined && { amount: copyMeasurement(row.amount) }),
    });
  }

  return {
    id: version.id,
    recipe_id: version.recipe_id,
    description: version.description,
    ingredients,
    sections: version.sections.map(remapSection),
    ...(version.estimated_time_seconds !== undefined && {
      estimated_time_seconds: version.estimated_time_seconds,
    }),
    ...(version.seconds_per_ingredient !== undefined && {
      seconds_per_ingredient: version.seconds_per_ingredient,
    }),
    created_at: version.created_at,
  };
}
