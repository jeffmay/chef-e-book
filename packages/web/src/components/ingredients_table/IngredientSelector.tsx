import { IngredientId, loadId, type Ingredient, type KitchenwareLabel } from "@recipe-book/shared";
import type { TreeNode } from "primereact/treenode";
import { TreeSelect, type TreeSelectChangeEvent } from "primereact/treeselect";
import { useMemo, type KeyboardEvent } from "react";
import "../../styles/treeSelect.css";
import { buildIngredientTree, type IngredientRow } from "./buildIngredientTree.ts";
import type { ReadonlyDeep } from "type-fest";
import "./IngredientSelector.css";

export type IngredientSelectorProps = ReadonlyDeep<{
  value: IngredientId | undefined;
  options: Ingredient[];
  labels: KitchenwareLabel[];
  onChange: (id: IngredientId | undefined) => void;
  ariaLabel: string;
  placeholder?: string;
}>;

function rowToNode(row: IngredientRow): TreeNode {
  return {
    key: row.id,
    label: row.name,
    data: row,
    children: row.subRows.length > 0 ? row.subRows.map(rowToNode) : undefined,
  };
}

export function IngredientSelector({
  value,
  options,
  labels,
  onChange,
  ariaLabel,
  placeholder = "— None —",
}: IngredientSelectorProps) {
  const treeNodes = useMemo(
    () => buildIngredientTree(options, labels).map(rowToNode),
    [options, labels],
  );

  function handleChange(e: TreeSelectChangeEvent): void {
    const v = e.value;
    if (v === null || v === undefined || v === "") {
      onChange(undefined);
    } else if (typeof v === "string") {
      onChange(loadId(IngredientId, v));
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLSpanElement>): void {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.stopPropagation();
    }
  }

  return (
    <span className="is-key-interceptor" onKeyDown={handleKeyDown}>
      <TreeSelect
        value={value ?? null}
        options={treeNodes}
        onChange={handleChange}
        selectionMode="single"
        filter
        placeholder={placeholder}
        className="tree-select is-selector"
        panelClassName="tree-select-panel"
        ariaLabel={ariaLabel}
        appendTo={document.body}
      />
    </span>
  );
}
