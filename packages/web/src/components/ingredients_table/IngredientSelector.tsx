import { type IngredientId, type Ingredient, type KitchenwareLabel } from "@recipe-book/shared";
import type { TreeNode } from "primereact/treenode";
import { TreeSelect, type TreeSelectChangeEvent } from "primereact/treeselect";
import { useMemo } from "react";
import { buildIngredientTree, type IngredientRow } from "./build_ingredient_tree.js";
import "./IngredientSelector.css";

export interface IngredientSelectorProps {
  readonly value: IngredientId | undefined;
  readonly options: readonly Ingredient[];
  readonly labels: readonly KitchenwareLabel[];
  readonly onChange: (id: IngredientId | undefined) => void;
  readonly aria_label: string;
  readonly placeholder?: string;
}

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
  aria_label,
  placeholder = "— None —",
}: IngredientSelectorProps) {
  const tree_nodes = useMemo(
    () => buildIngredientTree(options as Ingredient[], labels as KitchenwareLabel[]).map(rowToNode),
    [options, labels],
  );

  function handleChange(e: TreeSelectChangeEvent): void {
    const v = e.value;
    if (v === null || v === undefined || v === "") {
      onChange(undefined);
    } else if (typeof v === "string") {
      onChange(v as IngredientId);
    }
  }

  return (
    <TreeSelect
      value={value ?? null}
      options={tree_nodes}
      onChange={handleChange}
      selectionMode="single"
      filter
      placeholder={placeholder}
      className="is-selector"
      panelClassName="is-panel"
      ariaLabel={aria_label}
      appendTo="self"
    />
  );
}
