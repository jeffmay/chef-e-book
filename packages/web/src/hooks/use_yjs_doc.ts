import { useEffect, useRef } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";

export function useYjsDoc(userName: string): Y.Doc {
  const docRef = useRef<Y.Doc>(new Y.Doc());

  useEffect(() => {
    const persistence = new IndexeddbPersistence(userName, docRef.current);
    return () => {
      persistence.destroy();
    };
  }, [userName]);

  return docRef.current;
}
