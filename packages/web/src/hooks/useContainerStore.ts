import {
  addContainer,
  type Container,
  ContainerId,
  findContainerNameClash,
  getContainerYmap,
  getContainers,
  type KitchenwareLabelId,
  type NameClash,
  NameClashError,
  randomId,
  renameContainer,
  setLabelsForContainer,
  setParentForContainer,
} from "@recipe-book/shared";
import { useEffect, useState } from "react";
import { useBookDoc } from "../contexts/docContext.ts";
import type { ReadonlyDeep } from "type-fest";

export type NewContainerInput = {
  name: string;
  label_ids?: KitchenwareLabelId[];
  parent_id?: ContainerId;
};

export type UseContainerStoreResult = {
  containers: Container[];
  /** The container that already holds `name` (see `IngredientStore.nameClash`), or `undefined`. */
  nameClash: (name: string, excludeId?: ContainerId) => NameClash<ContainerId> | undefined;
  /** @throws NameClashError if another container already holds the name. */
  addContainer: (input: ReadonlyDeep<NewContainerInput>) => Container;
  /** @throws NameClashError if another container already holds the name. */
  renameContainer: (id: ContainerId, name: string) => void;
  setLabels: (id: ContainerId, label_ids: readonly KitchenwareLabelId[]) => void;
  setParent: (id: ContainerId, parent_id: ContainerId | undefined) => void;
};

export function useContainerStore(): UseContainerStoreResult {
  const { doc, whenSynced } = useBookDoc();
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
    nameClash: (name, excludeId) => findContainerNameClash(doc, name, excludeId),
    addContainer(input) {
      const clash = findContainerNameClash(doc, input.name);
      if (clash !== undefined) throw new NameClashError("container", clash);
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
      const clash = findContainerNameClash(doc, name, id);
      if (clash !== undefined) throw new NameClashError("container", clash);
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
