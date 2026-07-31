import type { SectionItem, SectionItemId } from "@recipe-book/shared";
import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import type { ReadonlyDeep } from "type-fest";

/**
 * Registry of rows whose inline editor is open with uncommitted changes.
 *
 * Instruction and container rows keep their edits in a local draft until the
 * per-row "✔︎" is pressed, so a page-level save would otherwise drop them
 * silently. Each row with a pending draft registers here; the page consults the
 * registry on save and resolves every pending row at once.
 *
 * Resolutions are returned as data (a map of updates and a set of removals)
 * rather than applied row by row: each row's `onChange` rebuilds the whole
 * section tree from the props of its last render, so committing several rows in
 * one tick would let the last write clobber the others.
 */

export type PendingEdit = {
  /** Builds the item that accepting this row's draft would produce. */
  readonly buildAccepted: () => ReadonlyDeep<SectionItem>;
  /**
   * True when discarding should drop the row entirely: it was added during this
   * editing session and never accepted, so there is nothing to revert to.
   */
  readonly discardRemovesItem: boolean;
  /** Reverts the draft and leaves edit mode. */
  readonly revert: () => void;
  /** Leaves edit mode once the accepted item has been applied by the page. */
  readonly close: () => void;
};

/** Rows register a ref so the registry always sees the latest render's closures. */
type PendingEditRef = { readonly current: PendingEdit };

export type PendingEditResolutions = {
  /** Items to replace in the section tree, keyed by section item id. */
  readonly updates: Map<SectionItemId, ReadonlyDeep<SectionItem>>;
  /** Ids of rows to drop from the section tree. */
  readonly removals: Set<SectionItemId>;
};

export type PendingSectionEdits = {
  readonly register: (id: SectionItemId, edit: PendingEditRef) => void;
  readonly unregister: (id: SectionItemId) => void;
  /** How many rows currently hold uncommitted edits. */
  readonly pendingCount: () => number;
  /** Accepts every pending row's draft and closes its editor. */
  readonly acceptAll: () => PendingEditResolutions;
  /** Reverts every pending row's draft and closes its editor. */
  readonly discardAll: () => PendingEditResolutions;
};

export function createPendingSectionEdits(): PendingSectionEdits {
  const entries = new Map<SectionItemId, PendingEditRef>();

  return {
    register(id, edit) {
      entries.set(id, edit);
    },
    unregister(id) {
      entries.delete(id);
    },
    pendingCount() {
      return entries.size;
    },
    acceptAll() {
      const updates = new Map<SectionItemId, ReadonlyDeep<SectionItem>>();
      for (const [id, edit] of [...entries]) {
        updates.set(id, edit.current.buildAccepted());
        edit.current.close();
      }
      return { updates, removals: new Set<SectionItemId>() };
    },
    discardAll() {
      const removals = new Set<SectionItemId>();
      for (const [id, edit] of [...entries]) {
        if (edit.current.discardRemovesItem) {
          removals.add(id);
        }
        edit.current.revert();
      }
      return { updates: new Map<SectionItemId, ReadonlyDeep<SectionItem>>(), removals };
    },
  };
}

/**
 * Provided by the page that owns the section tree. Rows rendered without a
 * provider (there is none in read-only contexts) keep working; their drafts are
 * simply not tracked.
 */
export const PendingSectionEditsContext = createContext<PendingSectionEdits | null>(null);

/** Creates a registry that lives for the lifetime of the owning component. */
export function usePendingSectionEdits(): PendingSectionEdits {
  return useMemo(() => createPendingSectionEdits(), []);
}

/**
 * Registers a row's uncommitted draft with the surrounding registry while
 * `pending` is true. The handlers are read through a ref so the registry always
 * calls the latest render's closures.
 */
export function usePendingEdit(id: SectionItemId, pending: boolean, edit: PendingEdit): void {
  const registry = useContext(PendingSectionEditsContext);
  const editRef = useRef(edit);

  // Runs before the registration effect below (effects fire in declaration
  // order), so a row registering for the first time exposes fresh handlers.
  useEffect(() => {
    editRef.current = edit;
  });

  useEffect(() => {
    if (!pending || registry === null) return;
    registry.register(id, editRef);
    return () => {
      registry.unregister(id);
    };
  }, [id, pending, registry]);
}
