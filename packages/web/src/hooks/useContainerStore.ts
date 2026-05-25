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
import { useKitchenwareDoc } from "../contexts/docContext.js";

export interface NewContainerInput {
  readonly name: string;
  readonly label_ids?: readonly KitchenwareLabelId[];
  readonly parent_id?: ContainerId;
}

export interface UseContainerStoreResult {
  readonly containers: readonly Container[];
  readonly addContainer: (input: NewContainerInput) => Container;
  readonly renameContainer: (id: ContainerId, name: string) => void;
  readonly setLabels: (id: ContainerId, label_ids: readonly KitchenwareLabelId[]) => void;
  readonly setParent: (id: ContainerId, parent_id: ContainerId | undefined) => void;
}

export function useContainerStore(): UseContainerStoreResult {
  const { doc, whenSynced } = useKitchenwareDoc();
  const [containers, setContainers] = useState<Container[]>(() => getContainers(doc));

  useEffect(() => {
    const map = getContainerYmap(doc);
    const handler = () => setContainers(getContainers(doc));
    map.observe(handler);
    whenSynced.then(() => setContainers(getContainers(doc)));
    return () => map.unobserve(handler);
  }, [doc, whenSynced]);

  return {
    containers,
    addContainer(input) {
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
    renameContainer(id, name) {
      renameContainer(doc, id, name);
    },
    setLabels(id, label_ids) {
      setLabelsForContainer(doc, id, label_ids);
    },
    setParent(id, parent_id) {
      setParentForContainer(doc, id, parent_id);
    },
  };
}
