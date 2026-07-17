import type { ReadonlyDeep } from "type-fest";
import type { RecipeVersion, SectionItemId } from "../types/recipe.ts";
import { collectIngredientItems, collectInstructions } from "../types/sections.ts";

/**
 * Fallback per-ingredient prep time (2 minutes) used when neither the
 * RecipeVersion nor the RecipeBook define one. The web app overrides this
 * chain's tail with the VITE_DEFAULT_SECONDS_PER_INGREDIENT build variable.
 */
export const DEFAULT_SECONDS_PER_INGREDIENT = 120;

/** Number of ingredient items in the version (including inside containers). */
export function countSessionIngredients(version: ReadonlyDeep<RecipeVersion>): number {
  return collectIngredientItems(version.sections).length;
}

/** Sum of all instruction durations in the version (missing durations count as 0). */
export function totalInstructionSeconds(version: ReadonlyDeep<RecipeVersion>): number {
  return collectInstructions(version.sections).reduce(
    (sum, i) => sum + (i.duration_seconds ?? 0),
    0,
  );
}

/**
 * Resolves the per-ingredient prep time for a version: the version's own
 * value when set, otherwise the provided fallback (the RecipeBook setting
 * or, absent that, the build default).
 */
export function resolveSecondsPerIngredient(
  version: ReadonlyDeep<RecipeVersion>,
  fallback_seconds: number,
): number {
  return version.seconds_per_ingredient ?? fallback_seconds;
}

/**
 * The lower bound for a version's estimated time:
 * total instruction durations + per-ingredient time × ingredient count.
 */
export function minimumEstimatedSeconds(
  version: ReadonlyDeep<RecipeVersion>,
  seconds_per_ingredient: number,
): number {
  return (
    totalInstructionSeconds(version) + seconds_per_ingredient * countSessionIngredients(version)
  );
}

/**
 * The estimated total time for a version: its stored override when set,
 * otherwise the computed minimum.
 */
export function resolveEstimatedSeconds(
  version: ReadonlyDeep<RecipeVersion>,
  seconds_per_ingredient: number,
): number {
  return version.estimated_time_seconds ?? minimumEstimatedSeconds(version, seconds_per_ingredient);
}

/**
 * Progress weight (in seconds) for every checkable item in a version.
 *
 * Each ingredient weighs the per-ingredient time. The remaining budget
 * (total − per-ingredient × count) is split across instructions in
 * proportion to their durations — so when the total equals the computed
 * minimum, each instruction weighs exactly its own duration; when the total
 * was adjusted, instruction weights scale accordingly. When no instruction
 * has a duration the instruction budget is split evenly.
 */
export function computeItemWeights(
  version: ReadonlyDeep<RecipeVersion>,
  total_seconds: number,
  seconds_per_ingredient: number,
): ReadonlyMap<SectionItemId, number> {
  const weights = new Map<SectionItemId, number>();
  const ingredients = collectIngredientItems(version.sections);
  const instructions = collectInstructions(version.sections);

  for (const item of ingredients) {
    weights.set(item.id, seconds_per_ingredient);
  }

  const instructionBudget = Math.max(
    0,
    total_seconds - seconds_per_ingredient * ingredients.length,
  );
  const durationTotal = instructions.reduce((sum, i) => sum + (i.duration_seconds ?? 0), 0);
  for (const item of instructions) {
    const weight =
      durationTotal > 0
        ? (instructionBudget * (item.duration_seconds ?? 0)) / durationTotal
        : instructionBudget / instructions.length;
    weights.set(item.id, weight);
  }

  return weights;
}

/**
 * Fraction complete (0–1) given item weights and the set of done item ids
 * (checked or skipped). When every weight is zero, falls back to a plain
 * count of done items so the bar still reaches 100%.
 */
export function progressFraction(
  weights: ReadonlyMap<SectionItemId, number>,
  done_ids: ReadonlySet<string>,
): number {
  if (weights.size === 0) return 0;
  let total = 0;
  let done = 0;
  let doneCount = 0;
  weights.forEach((weight, id) => {
    total += weight;
    if (done_ids.has(id)) {
      done += weight;
      doneCount += 1;
    }
  });
  if (total <= 0) return doneCount / weights.size;
  return done / total;
}
