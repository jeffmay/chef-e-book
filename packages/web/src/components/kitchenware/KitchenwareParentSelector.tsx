import { type Container, ContainerId, loadId } from "@recipe-book/shared";
import type { TreeNode } from "primereact/treenode";
import { TreeSelect, type TreeSelectChangeEvent } from "primereact/treeselect";
import { useMemo } from "react";
import type { ReadonlyDeep } from "type-fest";
import "./KitchenwareParentSelector.css";

type ContainerNode = {
  readonly id: ContainerId;
  readonly name: string;
  children: ContainerNode[];
};

function buildContainerTree(containers: ReadonlyDeep<Container[]>): ContainerNode[] {
  const byId = new Map<string, ContainerNode>();
  for (const c of containers) {
    byId.set(c.id, { id: c.id, name: c.name, children: [] });
  }
  const roots: ContainerNode[] = [];
  for (const node of byId.values()) {
    const c = containers.find((x) => x.id === node.id)!;
    if (c.parent_id !== undefined) {
      const parent = byId.get(c.parent_id);
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

export type KitchenwareParentSelectorProps = ReadonlyDeep<{
  value: ContainerId | undefined;
  containers: readonly Container[];
  onChange: (id: ContainerId | undefined) => void;
  ariaLabel?: string;
  placeholder?: string;
}>;

export function KitchenwareParentSelector({
  value,
  containers,
  onChange,
  ariaLabel = "Parent container",
  placeholder = "— None —",
}: KitchenwareParentSelectorProps) {
  const treeNodes = useMemo(() => buildContainerTree(containers).map(toTreeNode), [containers]);

  function handleChange(e: TreeSelectChangeEvent): void {
    const v = e.value;
    if (v === null || v === undefined || v === "") {
      onChange(undefined);
    } else if (typeof v === "string") {
      onChange(loadId(ContainerId, v));
    }
  }

  return (
    <TreeSelect
      value={value ?? null}
      options={treeNodes}
      onChange={handleChange}
      selectionMode="single"
      filter
      placeholder={placeholder}
      className="kps-selector"
      panelClassName="kps-panel"
      ariaLabel={ariaLabel}
      appendTo="self"
    />
  );
}
