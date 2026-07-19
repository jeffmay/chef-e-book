import {
  addLabel,
  deleteLabels as deleteLabelsInDoc,
  findOrCreateLabel,
  getLabels,
  getLabelsYmap,
  type KitchenwareKind,
  type KitchenwareLabel,
  KitchenwareLabelId,
  removeLabelFromAllIngredients,
  renameLabel as renameLabelInDoc,
  replaceLabelInAllIngredients,
} from "@recipe-book/shared";
import { loadId, randomId } from "@recipe-book/shared";
import { useEffect, useState } from "react";
import type * as Y from "yjs";
import { useKitchenwareDoc } from "../contexts/docContext.ts";

export interface LabelStore {
  labels: KitchenwareLabel[];
  createLabel: (name: string, kinds: ReadonlySet<KitchenwareKind>) => KitchenwareLabelId;
  findOrCreate: (name: string, kinds: ReadonlySet<KitchenwareKind>) => KitchenwareLabelId;
  renameLabel: (id: KitchenwareLabelId, name: string) => void;
  deleteLabels: (ids: readonly KitchenwareLabelId[]) => void;
  mergeLabels: (ids: readonly KitchenwareLabelId[], new_name: string) => KitchenwareLabelId;
}

export function useLabelStore(): LabelStore {
  const { doc, whenSynced } = useKitchenwareDoc();
  const [labels, setLabels] = useState<KitchenwareLabel[]>(() => getLabels(doc));

  useEffect(() => {
    const map = getLabelsYmap(doc);
    const handler = (event: Y.YMapEvent<unknown>) => {
      // Cascade deletions to all ingredient label sets
      event.changes.keys.forEach((change, key) => {
        if (change.action === "delete") {
          removeLabelFromAllIngredients(doc, loadId(KitchenwareLabelId, key));
        }
      });
      setLabels(getLabels(doc));
    };
    map.observe(handler);
    // Refresh labels once IndexedDB has finished loading existing data
    whenSynced.then(() => setLabels(getLabels(doc)));
    return () => map.unobserve(handler);
  }, [doc, whenSynced]);

  return {
    labels,
    createLabel(name, kinds) {
      return addLabel(doc, name, kinds);
    },
    findOrCreate(name, kinds) {
      return findOrCreateLabel(doc, name, kinds);
    },
    renameLabel(id, name) {
      renameLabelInDoc(doc, id, name);
    },
    deleteLabels(ids) {
      deleteLabelsInDoc(doc, ids);
    },
    mergeLabels(idsToMerge, newName) {
      const newId = randomId(KitchenwareLabelId);

      // Collect kinds from all merging labels
      const mergedKinds = new Set<KitchenwareKind>();
      const labelsMap = getLabelsYmap(doc);
      labelsMap.forEach((value, id) => {
        const labelId = loadId(KitchenwareLabelId, id);
        if (!idsToMerge.includes(labelId)) return;
        if (typeof value === "object" && value !== null) {
          const obj = value as Record<string, unknown>;
          const kinds = obj["kinds"];
          if (Array.isArray(kinds)) {
            for (const k of kinds) {
              if (k === "ingredient" || k === "container" || k === "equipment") {
                mergedKinds.add(k);
              }
            }
          }
        }
      });

      doc.transact(() => {
        // Create new merged label
        labelsMap.set(newId, { name: newName, kinds: [...mergedKinds] });
        // Update all ingredient references before deleting old labels
        replaceLabelInAllIngredients(doc, idsToMerge, newId);
        // Delete old labels (cascade delete observer is a no-op since refs are already updated)
        for (const id of idsToMerge) {
          labelsMap.delete(id);
        }
      });

      return newId;
    },
  };
}
