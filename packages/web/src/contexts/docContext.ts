import { createContext, useContext } from "react";
import type * as Y from "yjs";

export interface DocContextValue {
  doc: Y.Doc;
  whenSynced: Promise<unknown>;
}

export const BookDocContext = createContext<DocContextValue | null>(null);

export function useBookDoc(): DocContextValue {
  const doc = useContext(BookDocContext);
  if (doc === null) throw new Error("useBookDoc must be called inside a BookDocContext.Provider");
  return doc;
}
