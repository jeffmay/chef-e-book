import { useEffect, useRef } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";

export function useKitchenwareDoc(userName: string): Y.Doc {
  const docRef = useRef<Y.Doc>(new Y.Doc());

  useEffect(() => {
    const persistence = new IndexeddbPersistence(`kitchenware-${userName}`, docRef.current);
    return () => {
      persistence.destroy();
    };
  }, [userName]);

  return docRef.current;
}

export function useRecipeBookDoc(userName: string): Y.Doc {
  const docRef = useRef<Y.Doc>(new Y.Doc());

  useEffect(() => {
    const persistence = new IndexeddbPersistence(`recipes-${userName}`, docRef.current);
    return () => {
      persistence.destroy();
    };
  }, [userName]);

  return docRef.current;
}

/** @deprecated Use useKitchenwareDoc instead */
export const useYjsDoc = useKitchenwareDoc;
