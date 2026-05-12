import type { TreeNode } from "primereact/treenode";
import type { Ingredient, IngredientId, KitchenwareLabel, MeasurementType } from "@recipe-book/shared";
import type { ReadonlyDeep } from "type-fest";

export interface IngredientNodeData {
  readonly id: IngredientId;
  readonly name: string;
  readonly default_measurement_type: MeasurementType;
  readonly labels: readonly string[];
  readonly parent_id?: IngredientId;
  readonly parent_name: string;
}

export interface IngredientTreeNode extends TreeNode {
  key: string;
  data: IngredientNodeData;
  children?: IngredientTreeNode[];
}

export function buildIngredientTree(
  ingredients: ReadonlyDeep<Ingredient[]>,
  item_labels: ReadonlyDeep<KitchenwareLabel[]>,
): IngredientTreeNode[] {
  const label_name_by_id = new Map<string, string>(item_labels.map((l) => [l.id, l.name]));
  const id_to_name = new Map<string, string>(ingredients.map((i) => [i.id, i.name]));

  const node_map = new Map<string, IngredientTreeNode>();

  for (const i of ingredients) {
    const label_names = [...i.labels]
      .map((id) => label_name_by_id.get(id) ?? id)
      .sort((a, b) => a.localeCompare(b));
    const node: IngredientTreeNode = {
      key: i.id,
      data: {
        id: i.id,
        name: i.name,
        default_measurement_type: i.default_measurement_type,
        labels: label_names,
        parent_name: i.parent_id !== undefined ? (id_to_name.get(i.parent_id) ?? i.parent_id) : "",
        ...(i.parent_id !== undefined && { parent_id: i.parent_id }),
      },
    };
    node_map.set(i.id, node);
  }

  const roots: IngredientTreeNode[] = [];

  for (const node of node_map.values()) {
    if (node.data.parent_id !== undefined) {
      const parent = node_map.get(node.data.parent_id);
      if (parent !== undefined) {
        if (!parent.children) parent.children = [];
        parent.children.push(node);
        continue;
      }
    }
    roots.push(node);
  }

  function sortLevel(nodes: IngredientTreeNode[]): void {
    nodes.sort((a, b) => a.data.name.localeCompare(b.data.name));
    for (const n of nodes) {
      if (n.children) sortLevel(n.children);
    }
  }
  sortLevel(roots);

  return roots;
}
