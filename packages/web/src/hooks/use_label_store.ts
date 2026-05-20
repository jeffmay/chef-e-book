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
  replaceLabelInAllIngredients
} from "@recipe-book/shared";
import { loadId, randomId } from "@recipe-book/shared/src/types/ids.js";
import { useEffect, useState } from "react";
import * as Y from "yjs";
import { useDoc } from "../contexts/doc_context.js";

export interface UseLabelStoreResult {
  readonly labels: readonly KitchenwareLabel[];
  readonly createLabel: (name: string, kinds: ReadonlySet<KitchenwareKind>) => KitchenwareLabelId;
  readonly findOrCreate: (name: string, kinds: ReadonlySet<KitchenwareKind>) => KitchenwareLabelId;
  readonly renameLabel: (id: KitchenwareLabelId, name: string) => void;
  readonly deleteLabels: (ids: readonly KitchenwareLabelId[]) => void;
  readonly mergeLabels: (ids: readonly KitchenwareLabelId[], new_name: string) => KitchenwareLabelId;
}

export function useLabelStore(): UseLabelStoreResult {
  const doc = useDoc();
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
    return () => map.unobserve(handler);
  }, [doc]);

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
    mergeLabels(idsToMerge, new_name) {
      const new_id = randomId(KitchenwareLabelId);

      // Collect kinds from all merging labels
      const mergedKinds = new Set<KitchenwareKind>();
      const labelsMap = getLabelsYmap(doc);
      labelsMap.forEach((value, id) => {
        const label_id = loadId(KitchenwareLabelId, id);
        if (!idsToMerge.includes(label_id)) return;
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
        labelsMap.set(new_id, { name: new_name, kinds: [...mergedKinds] });
        // Update all ingredient references before deleting old labels
        replaceLabelInAllIngredients(doc, idsToMerge, new_id);
        // Delete old labels (cascade delete observer is a no-op since refs are already updated)
        for (const id of idsToMerge) {
          labelsMap.delete(id);
        }
      });

      return new_id;
    },
  };
}
