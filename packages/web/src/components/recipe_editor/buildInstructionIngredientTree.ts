import type { Ingredient, IngredientItem, Section, SectionItem } from "@recipe-book/shared";
import { IngredientId, loadId } from "@recipe-book/shared";
import type { TreeNode } from "primereact/treenode";
import type { ReadonlyDeep } from "type-fest";
import { COMMON_CONTAINERS } from "./containers.ts";

/** A leaf TreeNode carries the ingredient it represents in `data`. */
interface IngredientNodeData {
  readonly ingredient_id: IngredientId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads the `ingredient_id` off a leaf node's `data`, or `undefined` when the
 * node is a grouping node (a container) with no ingredient of its own.
 */
function leafIngredientId(node: ReadonlyDeep<TreeNode>): string | undefined {
  const data: unknown = node.data;
  if (isRecord(data) && typeof data.ingredient_id === "string") {
    return data.ingredient_id;
  }
  return undefined;
}

/**
 * Builds the TreeSelect options for an instruction's ingredient picker from the
 * recipe's own sections. Ingredients placed directly in a section appear at the
 * root; ingredients inside a container are grouped beneath that container.
 * Containers may only contain ingredients, so empty containers are omitted —
 * to offer another ingredient the user adds it to a section or container first.
 */
export function buildInstructionIngredientTree(
  sections: ReadonlyDeep<Section[]>,
  allIngredients: ReadonlyDeep<Ingredient[]>,
): TreeNode[] {
  const nameById = new Map<string, string>(allIngredients.map((i) => [i.id, i.name]));
  const roots: TreeNode[] = [];

  function ingredientLeaf(item: ReadonlyDeep<IngredientItem>): TreeNode {
    const data: IngredientNodeData = { ingredient_id: item.ingredient_id };
    return {
      key: item.id,
      label: nameById.get(item.ingredient_id) ?? item.ingredient_id,
      data,
    };
  }

  function walk(contents: ReadonlyDeep<SectionItem[]>): void {
    for (const it of contents) {
      if (it.kind === "ingredient") {
        roots.push(ingredientLeaf(it));
      } else if (it.kind === "container") {
        if (it.contents.length === 0) continue;
        const containerName =
          COMMON_CONTAINERS.find((c) => c.id === it.container_id)?.name ?? it.container_id;
        roots.push({
          key: it.id,
          label: it.descriptor ? `${containerName} — ${it.descriptor}` : containerName,
          selectable: true,
          children: it.contents.map(ingredientLeaf),
        });
      } else if (it.kind === "section") {
        walk(it.contents);
      }
    }
  }

  for (const section of sections) walk(section.contents);
  return roots;
}

/** Maps every leaf node key to the ingredient it represents. */
export function collectKeyToIngredientId(
  nodes: ReadonlyDeep<TreeNode[]>,
): Map<string, IngredientId> {
  const map = new Map<string, IngredientId>();
  function visit(node: ReadonlyDeep<TreeNode>): void {
    const ingId = leafIngredientId(node);
    if (ingId !== undefined) map.set(String(node.key), loadId(IngredientId, ingId));
    node.children?.forEach(visit);
  }
  nodes.forEach(visit);
  return map;
}

/** Selection state for a single node in TreeSelect's checkbox mode. */
export type NodeSelectionState = {
  checked: boolean;
  partialChecked: boolean;
};

/**
 * Builds TreeSelect's checkbox selection map from the ingredient ids referenced
 * by an instruction. A container node is fully checked when all its ingredient
 * children are referenced, and partially checked when only some are.
 */
export function ingredientIdsToSelection(
  nodes: ReadonlyDeep<TreeNode[]>,
  ids: ReadonlyDeep<IngredientId[]>,
): Record<string, NodeSelectionState> {
  const idSet = new Set<string>(ids);
  const map: Record<string, NodeSelectionState> = {};

  function visit(node: ReadonlyDeep<TreeNode>): boolean {
    const key = String(node.key);
    const children = node.children;
    if (children === undefined || children.length === 0) {
      const ingId = leafIngredientId(node);
      const checked = ingId !== undefined && idSet.has(ingId);
      if (checked) map[key] = { checked: true, partialChecked: false };
      return checked;
    }
    const childChecked = children.map(visit);
    const allChecked = childChecked.every(Boolean);
    const someChecked = childChecked.some(Boolean);
    if (allChecked) map[key] = { checked: true, partialChecked: false };
    else if (someChecked) map[key] = { checked: false, partialChecked: true };
    return allChecked;
  }

  nodes.forEach(visit);
  return map;
}

/**
 * Normalizes the (untyped) selection value emitted by TreeSelect's onChange into
 * a `key -> checked` map, ignoring partially-checked grouping nodes.
 */
export function parseSelectionKeys(value: unknown): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  if (!isRecord(value)) return result;
  for (const [key, raw] of Object.entries(value)) {
    if (isRecord(raw)) result[key] = raw.checked === true;
  }
  return result;
}

/**
 * Resolves a TreeSelect selection value back to the distinct ingredient ids it
 * references (the same ingredient appearing under two containers collapses to a
 * single id).
 */
export function selectionToIngredientIds(
  value: unknown,
  keyToIngredientId: Map<string, IngredientId>,
): IngredientId[] {
  const parsed = parseSelectionKeys(value);
  const ids: IngredientId[] = [];
  const seen = new Set<IngredientId>();
  for (const [key, checked] of Object.entries(parsed)) {
    if (!checked) continue;
    const ingId = keyToIngredientId.get(key);
    if (ingId !== undefined && !seen.has(ingId)) {
      seen.add(ingId);
      ids.push(ingId);
    }
  }
  return ids;
}
