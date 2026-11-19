import { useEffect, useMemo, useRef } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import type { DocContextValue } from "../contexts/docContext.ts";
import { bookDatabaseName, mergeLegacyBookData } from "../storage/legacyBookMigration.ts";

interface ResolvableSync {
  readonly promise: Promise<unknown>;
  readonly resolve: (value?: unknown) => void;
}

function makeResolvableSync(): ResolvableSync {
  let resolve!: (value?: unknown) => void;
  const promise = new Promise<unknown>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/**
 * The one Yjs document for a recipe book: ingredients, containers, labels, recipes, folders,
 * sessions and settings all live in it, so a single `Y.UndoManager` can later cover the book.
 *
 * Creates a stable Y.Doc + a self-resolving `whenSynced` promise that survives React StrictMode's
 * double-invoke of effects (mount → cleanup → mount again). The persistence is created inside the
 * effect so StrictMode can destroy and recreate it; the manually-resolved promise is stored in a
 * ref so all consumers always await the same promise instance regardless of remounts.
 *
 * `whenSynced` resolves only after IndexedDB has loaded **and** any data an earlier build kept in
 * the separate `kitchenware-*` / `recipes-*` databases has been merged in, so consumers (notably
 * the default-kitchenware seed, which runs when the book looks empty) never see a half-migrated
 * book. A migration failure is logged and does not block the app.
 */
export function useBookDoc(bookId: string): DocContextValue {
  const docRef = useRef<Y.Doc>(new Y.Doc());
  const syncRef = useRef<ResolvableSync | null>(null);
  if (syncRef.current === null) {
    syncRef.current = makeResolvableSync();
  }

  useEffect(() => {
    let cancelled = false;
    const doc = docRef.current;
    const persistence = new IndexeddbPersistence(bookDatabaseName(bookId), doc);
    (async function syncBook() {
      await persistence.whenSynced;
      try {
        await mergeLegacyBookData(doc, bookId, { isCancelled: () => cancelled });
      } catch (e) {
        console.error("failed to migrate data from the legacy kitchenware/recipes databases: ", e);
      }
      // A cancelled run (StrictMode, unmount) may have skipped the merge; the next run resolves.
      if (!cancelled) syncRef.current!.resolve();
    })();
    return () => {
      cancelled = true;
      persistence.destroy();
    };
  }, [bookId]);

  const whenSynced = syncRef.current.promise;
  // The same object every render, so the context it is provided through does not change identity
  // (and re-render every consumer) whenever the shell re-renders.
  return useMemo(() => ({ doc: docRef.current, whenSynced }), [whenSynced]);
}
