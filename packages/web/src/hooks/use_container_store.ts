import {
  addContainer,
  type Container,
  ContainerId,
  getContainerYmap,
  getContainers,
  type KitchenwareLabelId,
  randomId,
  renameContainer,
  setLabelsForContainer,
  setParentForContainer,
} from "@recipe-book/shared";
import { useEffect, useState } from "react";
import { useDoc } from "../contexts/doc_context.js";

export interface NewContainerInput {
  readonly name: string;
  readonly label_ids?: readonly KitchenwareLabelId[];
  readonly parent_id?: ContainerId;
}

export interface UseContainerStoreResult {
  readonly containers: readonly Container[];
  readonly add_container: (input: NewContainerInput) => Container;
  readonly rename_container: (id: ContainerId, name: string) => void;
  readonly set_labels: (id: ContainerId, label_ids: readonly KitchenwareLabelId[]) => void;
  readonly set_parent: (id: ContainerId, parent_id: ContainerId | undefined) => void;
}

export function useContainerStore(): UseContainerStoreResult {
  const doc = useDoc();
  const [containers, set_containers] = useState<Container[]>(() => getContainers(doc));

  useEffect(() => {
    const map = getContainerYmap(doc);
    const handler = () => set_containers(getContainers(doc));
    map.observe(handler);
    return () => map.unobserve(handler);
  }, [doc]);

  return {
    containers,
    add_container(input) {
      const id = randomId(ContainerId);
      const container: Container = {
        kind: "container",
        id,
        name: input.name,
        labels: new Set(input.label_ids ?? []),
        ...(input.parent_id !== undefined && { parent_id: input.parent_id }),
      };
      addContainer(doc, container);
      return container;
    },
    rename_container(id, name) {
      renameContainer(doc, id, name);
    },
    set_labels(id, label_ids) {
      setLabelsForContainer(doc, id, label_ids);
    },
    set_parent(id, parent_id) {
      setParentForContainer(doc, id, parent_id);
    },
  };
}
