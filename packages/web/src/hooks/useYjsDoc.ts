import { useEffect, useRef } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import type { DocContextValue } from "../contexts/docContext.js";

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

// Creates a stable Y.Doc + a self-resolving whenSynced promise that survives
// React StrictMode's double-invoke of effects (mount → cleanup → mount again).
// The persistence is created inside the effect so StrictMode can destroy and
// recreate it; the manually-resolved promise is stored in a ref so all
// consumers always await the same promise instance regardless of remounts.
function useYjsDocForName(name: string): DocContextValue {
  const docRef = useRef<Y.Doc>(new Y.Doc());
  const syncRef = useRef<ResolvableSync | null>(null);
  if (syncRef.current === null) {
    syncRef.current = makeResolvableSync();
  }

  useEffect(() => {
    const persistence = new IndexeddbPersistence(name, docRef.current);
    persistence.whenSynced.then(() => syncRef.current!.resolve());
    return () => {
      persistence.destroy();
    };
  }, [name]);

  return { doc: docRef.current, whenSynced: syncRef.current.promise };
}

export function useKitchenwareDoc(userName: string): DocContextValue {
  return useYjsDocForName(`kitchenware-${userName}`);
}

export function useRecipeBookDoc(userName: string): DocContextValue {
  return useYjsDocForName(`recipes-${userName}`);
}
