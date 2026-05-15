import { type Container, type ContainerId } from "@recipe-book/shared";
import type { TreeNode } from "primereact/treenode";
import { TreeSelect, type TreeSelectChangeEvent } from "primereact/treeselect";
import { useMemo } from "react";
import "./KitchenwareParentSelector.css";

interface ContainerNode {
  id: ContainerId;
  name: string;
  children: ContainerNode[];
}

function buildContainerTree(containers: readonly Container[]): ContainerNode[] {
  const by_id = new Map<string, ContainerNode>();
  for (const c of containers) {
    by_id.set(c.id, { id: c.id, name: c.name, children: [] });
  }
  const roots: ContainerNode[] = [];
  for (const node of by_id.values()) {
    const c = containers.find((x) => x.id === node.id)!;
    if (c.parent_id !== undefined) {
      const parent = by_id.get(c.parent_id);
      if (parent !== undefined) {
        parent.children.push(node);
        continue;
      }
    }
    roots.push(node);
  }
  return roots;
}

function toTreeNode(node: ContainerNode): TreeNode {
  return {
    key: node.id,
    label: node.name,
    children: node.children.length > 0 ? node.children.map(toTreeNode) : undefined,
  };
}

export interface KitchenwareParentSelectorProps {
  readonly value: ContainerId | undefined;
  readonly containers: readonly Container[];
  readonly onChange: (id: ContainerId | undefined) => void;
  readonly aria_label?: string;
  readonly placeholder?: string;
}

export function KitchenwareParentSelector({
  value,
  containers,
  onChange,
  aria_label = "Parent container",
  placeholder = "— None —",
}: KitchenwareParentSelectorProps) {
  const tree_nodes = useMemo(() => buildContainerTree(containers).map(toTreeNode), [containers]);

  function handleChange(e: TreeSelectChangeEvent): void {
    const v = e.value;
    if (v === null || v === undefined || v === "") {
      onChange(undefined);
    } else if (typeof v === "string") {
      onChange(v as ContainerId);
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
      className="kps-selector"
      panelClassName="kps-panel"
      ariaLabel={aria_label}
      appendTo="self"
    />
  );
}
