import type { ContainerItem, Ingredient, Instruction } from "@recipe-book/shared";
import isEqual from "lodash/isEqual";
import type { ReadonlyDeep } from "type-fest";
import { humanizeSeconds } from "../duration/humanizeSeconds.ts";
import { COMMON_CONTAINERS } from "./containers.ts";
import { COMMON_EQUIPMENT } from "./equipment.ts";

/**
 * Pure helpers behind the inline-edit rows (instructions and containers): each
 * row keeps a local `draft`, shows a one-line summary while closed, and merges
 * the draft back into the live item on accept.
 */

// ---------------------------------------------------------------------------
// Display names
// ---------------------------------------------------------------------------

export function containerDisplayName(item: ReadonlyDeep<ContainerItem>): string {
  return COMMON_CONTAINERS.find((c) => c.id === item.container_id)?.name ?? item.container_id;
}

// ---------------------------------------------------------------------------
// Blank items — opened directly in edit mode
// ---------------------------------------------------------------------------

/** A freshly-added instruction has no fields set yet. */
export function isBlankInstruction(item: ReadonlyDeep<Instruction>): boolean {
  return (
    item.instruction === "" &&
    item.equipment_id === undefined &&
    item.duration_seconds === undefined &&
    (item.ingredient_ids === undefined || item.ingredient_ids.length === 0)
  );
}

/** A freshly-added container has no descriptor and no contents yet. */
export function isBlankContainer(item: ReadonlyDeep<ContainerItem>): boolean {
  return item.descriptor === "" && item.ordered !== true && item.contents.length === 0;
}

// ---------------------------------------------------------------------------
// Summaries — the closed (read-only) view of a row
// ---------------------------------------------------------------------------

export function summarizeInstruction(
  item: ReadonlyDeep<Instruction>,
  allIngredients: ReadonlyDeep<Ingredient[]>,
): string {
  const parts: string[] = [item.instruction || "Untitled instruction"];

  const ingredientNames = (item.ingredient_ids ?? [])
    .map((id) => allIngredients.find((ingredient) => ingredient.id === id)?.name)
    .filter((name): name is string => name !== undefined);
  if (ingredientNames.length > 0) {
    parts.push(`the ${ingredientNames.join(", ")}`);
  }

  const equipment =
    item.equipment_id !== undefined
      ? COMMON_EQUIPMENT.find((eq) => eq.id === item.equipment_id)
      : undefined;
  if (equipment !== undefined) {
    parts.push(`in the ${equipment.name}`);
  }

  if (item.duration_seconds !== undefined) {
    parts.push(`for ${humanizeSeconds(item.duration_seconds)}`);
  }

  return parts.join(" ");
}

export function summarizeContainer(item: ReadonlyDeep<ContainerItem>): string {
  const name = containerDisplayName(item);
  const parts: string[] = [item.descriptor ? `${name} — ${item.descriptor}` : name];
  if (item.ordered === true) {
    parts.push("(ordered)");
  }
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Draft merges
// ---------------------------------------------------------------------------

/**
 * Merges an instruction draft back into the live item: fields the user changed
 * since the editor opened (`snapshot` → `draft`) win, and untouched fields fall
 * back to `live` so a concurrent edit from another device survives the accept.
 */
export function mergeInstructionDraft(
  snapshot: ReadonlyDeep<Instruction>,
  draft: ReadonlyDeep<Instruction>,
  live: ReadonlyDeep<Instruction>,
): ReadonlyDeep<Instruction> {
  const instruction =
    snapshot.instruction !== draft.instruction ? draft.instruction : live.instruction;
  const equipment_id =
    snapshot.equipment_id !== draft.equipment_id ? draft.equipment_id : live.equipment_id;
  const duration_seconds =
    snapshot.duration_seconds !== draft.duration_seconds
      ? draft.duration_seconds
      : live.duration_seconds;
  const ingredient_ids = isEqual(snapshot.ingredient_ids, draft.ingredient_ids)
    ? live.ingredient_ids
    : draft.ingredient_ids;

  return {
    id: live.id,
    kind: "instruction",
    instruction,
    ...(live.notes !== undefined && { notes: live.notes }),
    ...(equipment_id !== undefined && { equipment_id }),
    ...(duration_seconds !== undefined && { duration_seconds }),
    ...(ingredient_ids !== undefined && { ingredient_ids }),
  };
}

/**
 * Merges a container draft back into the live item. Only the header fields
 * (type, descriptor, ordered) are drafted; `contents` always come from the live
 * item because nested ingredient rows write through immediately.
 */
export function mergeContainerDraft(
  snapshot: ReadonlyDeep<ContainerItem>,
  draft: ReadonlyDeep<ContainerItem>,
  live: ReadonlyDeep<ContainerItem>,
): ReadonlyDeep<ContainerItem> {
  const container_id =
    snapshot.container_id !== draft.container_id ? draft.container_id : live.container_id;
  const descriptor = snapshot.descriptor !== draft.descriptor ? draft.descriptor : live.descriptor;
  const ordered = snapshot.ordered !== draft.ordered ? draft.ordered : live.ordered;

  return {
    id: live.id,
    kind: "container",
    container_id,
    descriptor,
    contents: live.contents,
    ...(live.notes !== undefined && { notes: live.notes }),
    ...(ordered !== undefined && { ordered }),
  };
}
