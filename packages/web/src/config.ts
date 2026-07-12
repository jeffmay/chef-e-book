import { DEFAULT_SECONDS_PER_INGREDIENT } from "@recipe-book/shared";

/**
 * Parses a raw Vite env value into a non-negative number of seconds, falling
 * back to the shared default (2 minutes) when unset or invalid.
 */
export function parseSecondsPerIngredient(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_SECONDS_PER_INGREDIENT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_SECONDS_PER_INGREDIENT;
  return parsed;
}

/**
 * Build-time default per-ingredient prep time. The RecipeBook setting
 * overrides this, and a RecipeVersion's own value overrides both.
 */
export const BUILD_SECONDS_PER_INGREDIENT = parseSecondsPerIngredient(
  import.meta.env.VITE_DEFAULT_SECONDS_PER_INGREDIENT,
);
