import type { IngredientId } from "@recipe-book/shared";
import type { TreeNode } from "primereact/treenode";
import { TreeSelect, type TreeSelectChangeEvent } from "primereact/treeselect";
import { useMemo, type KeyboardEvent } from "react";
import type { ReadonlyDeep } from "type-fest";
import "../../styles/treeSelect.css";
import {
  collectKeyToIngredientId,
  ingredientIdsToSelection,
  selectionToIngredientIds,
} from "./buildInstructionIngredientTree.ts";
import "./InstructionIngredientSelector.css";

export type InstructionIngredientSelectorProps = ReadonlyDeep<{
  nodes: TreeNode[];
  selectedIds: IngredientId[];
  onChange: (ids: readonly IngredientId[]) => void;
  ariaLabel?: string;
}>;

/**
 * Multi-select TreeSelect for choosing which of the recipe's ingredients an
 * instruction acts on. Options come from the recipe's sections (grouped by
 * container), so an instruction can only reference ingredients that already
 * exist in the recipe.
 */
export function InstructionIngredientSelector({
  nodes,
  selectedIds,
  onChange,
  ariaLabel = "Instruction ingredients",
}: InstructionIngredientSelectorProps) {
  const keyToIngredientId = useMemo(() => collectKeyToIngredientId(nodes), [nodes]);
  const selectionKeys = useMemo(
    () => ingredientIdsToSelection(nodes, selectedIds),
    [nodes, selectedIds],
  );

  function handleChange(e: TreeSelectChangeEvent): void {
    onChange(selectionToIngredientIds(e.value, keyToIngredientId));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLSpanElement>): void {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.stopPropagation();
    }
  }

  return (
    <span className="iis-key-interceptor" onKeyDown={handleKeyDown}>
      <TreeSelect
        value={selectionKeys}
        options={nodes as TreeNode[] /* safe: the nodes are never mutated by the library */}
        onChange={handleChange}
        selectionMode="checkbox"
        display="chip"
        metaKeySelection={false}
        filter
        placeholder="— Select ingredients —"
        emptyMessage="Add ingredients to a section or container first"
        className="tree-select iis-selector"
        panelClassName="tree-select-panel"
        ariaLabel={ariaLabel}
        appendTo={document.body}
      />
    </span>
  );
}
