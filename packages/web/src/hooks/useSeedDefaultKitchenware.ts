import {
  isDefaultKitchenwareSeeded,
  needsDefaultKitchenware,
  seedDefaultKitchenware,
} from "@recipe-book/shared";
import { useEffect } from "react";
import type { DocContextValue } from "../contexts/docContext.ts";
import { loadDefaultKitchenware } from "../storage/defaultKitchenware.ts";

/**
 * Puts the default kitchenware into the open book the first time it is opened, and never again —
 * see `seedDefaultKitchenware`. Runs once IndexedDB and the legacy-data merge have finished, so an
 * existing book is never mistaken for an empty one.
 *
 * The defaults are only fetched when the book actually needs them. If the fetch fails, or yields
 * nothing, the book is left unmarked so the next open tries again.
 */
export function useSeedDefaultKitchenware({ doc, whenSynced }: DocContextValue): void {
  useEffect(() => {
    let cancelled = false;
    (async function seed() {
      await whenSynced;
      if (cancelled || isDefaultKitchenwareSeeded(doc)) return;
      try {
        const templates = needsDefaultKitchenware(doc) ? await loadDefaultKitchenware() : [];
        if (cancelled) return;
        if (templates.length === 0 && needsDefaultKitchenware(doc)) {
          console.warn("the default kitchenware is empty; will try again next time the book opens");
          return;
        }
        seedDefaultKitchenware(doc, templates);
      } catch (e) {
        console.warn("failed to import default kitchenware: ", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, whenSynced]);
}
