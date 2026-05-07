import { useState, useEffect } from "react";
import * as Y from "yjs";
import type { ItemLabel } from "@recipe-book/shared";
import type { ItemKind } from "@recipe-book/shared";
import {
  get_labels,
  get_labels_ymap,
  add_label,
  find_or_create_label,
  delete_labels as delete_labels_in_doc,
  rename_label as rename_label_in_doc,
  make_label_id,
} from "@recipe-book/shared";
import {
  remove_label_from_all_ingredients,
  replace_label_in_all_ingredients,
} from "@recipe-book/shared";
import { use_doc } from "../contexts/doc_context.js";

export interface UseLabelStoreResult {
  readonly labels: readonly ItemLabel[];
  readonly create_label: (name: string, kinds: ReadonlySet<ItemKind>) => ItemLabel.Id;
  readonly find_or_create: (name: string, kinds: ReadonlySet<ItemKind>) => ItemLabel.Id;
  readonly rename_label: (id: ItemLabel.Id, name: string) => void;
  readonly delete_labels: (ids: readonly ItemLabel.Id[]) => void;
  readonly merge_labels: (ids: readonly ItemLabel.Id[], new_name: string) => ItemLabel.Id;
}

export function use_label_store(): UseLabelStoreResult {
  const doc = use_doc();
  const [labels, set_labels] = useState<ItemLabel[]>(() => get_labels(doc));

  useEffect(() => {
    const map = get_labels_ymap(doc);
    const handler = (event: Y.YMapEvent<unknown>) => {
      // Cascade deletions to all ingredient label sets
      event.changes.keys.forEach((change, key) => {
        if (change.action === "delete") {
          remove_label_from_all_ingredients(doc, key as ItemLabel.Id);
        }
      });
      set_labels(get_labels(doc));
    };
    map.observe(handler);
    return () => map.unobserve(handler);
  }, [doc]);

  return {
    labels,
    create_label(name, kinds) {
      return add_label(doc, name, kinds);
    },
    find_or_create(name, kinds) {
      return find_or_create_label(doc, name, kinds);
    },
    rename_label(id, name) {
      rename_label_in_doc(doc, id, name);
    },
    delete_labels(ids) {
      delete_labels_in_doc(doc, ids);
    },
    merge_labels(ids_to_merge, new_name) {
      const new_id = make_label_id();

      // Collect kinds from all merging labels
      const merged_kinds = new Set<ItemKind>();
      const labels_map = get_labels_ymap(doc);
      labels_map.forEach((value, id) => {
        if (!ids_to_merge.includes(id as ItemLabel.Id)) return;
        if (typeof value === "object" && value !== null) {
          const obj = value as Record<string, unknown>;
          const kinds = obj["kinds"];
          if (Array.isArray(kinds)) {
            for (const k of kinds) {
              if (k === "ingredient" || k === "container" || k === "equipment") {
                merged_kinds.add(k);
              }
            }
          }
        }
      });

      doc.transact(() => {
        // Create new merged label
        labels_map.set(new_id, { name: new_name, kinds: [...merged_kinds] });
        // Update all ingredient references before deleting old labels
        replace_label_in_all_ingredients(doc, ids_to_merge, new_id);
        // Delete old labels (cascade delete observer is a no-op since refs are already updated)
        for (const id of ids_to_merge) {
          labels_map.delete(id);
        }
      });

      return new_id;
    },
  };
}
