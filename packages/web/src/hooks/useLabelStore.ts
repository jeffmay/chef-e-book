import {
  addLabel,
  deleteLabels as deleteLabelsInDoc,
  findLabelNameClash,
  findOrCreateLabel,
  getLabels,
  getLabelsYmap,
  putLabel,
  type KitchenwareKind,
  type KitchenwareLabel,
  KitchenwareLabelId,
  type NameClash,
  NameClashError,
  removeLabelFromAllIngredients,
  renameLabel as renameLabelInDoc,
  replaceLabelInAllIngredients,
} from "@recipe-book/shared";
import { loadId, randomId } from "@recipe-book/shared";
import { useEffect, useState } from "react";
import type * as Y from "yjs";
import { useBookDoc } from "../contexts/docContext.ts";

export interface LabelStore {
  labels: KitchenwareLabel[];
  /**
   * The label that already holds `name` — in any case, ignoring surrounding whitespace, but **not**
   * as a plural: "Spices" and "Spice" are different labels — or `undefined` if it is free.
   * `exclude` is the label being renamed, or the labels being merged: they never clash.
   */
  nameClash: (
    name: string,
    exclude?: KitchenwareLabelId | readonly KitchenwareLabelId[],
  ) => NameClash<KitchenwareLabelId> | undefined;
  /** @throws NameClashError if another label already holds the name. */
  createLabel: (name: string, kinds: ReadonlySet<KitchenwareKind>) => KitchenwareLabelId;
  /** Reuses the label that holds `name` (in any case), or creates it. Never clashes. */
  findOrCreate: (name: string, kinds: ReadonlySet<KitchenwareKind>) => KitchenwareLabelId;
  /** @throws NameClashError if another label already holds the name. */
  renameLabel: (id: KitchenwareLabelId, name: string) => void;
  deleteLabels: (ids: readonly KitchenwareLabelId[]) => void;
  /** @throws NameClashError if a label outside `ids` already holds the new name. */
  mergeLabels: (ids: readonly KitchenwareLabelId[], new_name: string) => KitchenwareLabelId;
}

export function useLabelStore(): LabelStore {
  const { doc, whenSynced } = useBookDoc();
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
    nameClash: (name, exclude) => findLabelNameClash(doc, name, exclude),
    createLabel(name, kinds) {
      const clash = findLabelNameClash(doc, name);
      if (clash !== undefined) throw new NameClashError("label", clash);
      return addLabel(doc, name, kinds);
    },
    findOrCreate(name, kinds) {
      return findOrCreateLabel(doc, name, kinds);
    },
    renameLabel(id, name) {
      const clash = findLabelNameClash(doc, name, id);
      if (clash !== undefined) throw new NameClashError("label", clash);
      renameLabelInDoc(doc, id, name);
    },
    deleteLabels(ids) {
      // Deleting a label also takes it off every ingredient. Doing both in one transaction makes
      // them one undo step; the observer above still does the same clean-up for deletions that
      // arrive from elsewhere, and finds nothing left to do here.
      doc.transact(() => {
        deleteLabelsInDoc(doc, ids);
        for (const id of ids) removeLabelFromAllIngredients(doc, id);
      });
    },
    mergeLabels(idsToMerge, newName) {
      const clash = findLabelNameClash(doc, newName, idsToMerge);
      if (clash !== undefined) throw new NameClashError("label", clash);
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
        putLabel(doc, { id: newId, name: newName, kinds: mergedKinds });
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
