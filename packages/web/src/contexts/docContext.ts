import { createContext, useContext } from "react";
import * as Y from "yjs";

export interface DocContextValue {
  doc: Y.Doc;
  whenSynced: Promise<unknown>;
}

export const KitchenwareDocContext = createContext<DocContextValue | null>(null);
export const RecipeBookDocContext = createContext<DocContextValue | null>(null);

export function useKitchenwareDoc(): DocContextValue {
  const doc = useContext(KitchenwareDocContext);
  if (doc === null)
    throw new Error("useKitchenwareDoc must be called inside a KitchenwareDocContext.Provider");
  return doc;
}

export function useRecipeBookDoc(): DocContextValue {
  const doc = useContext(RecipeBookDocContext);
  if (doc === null)
    throw new Error("useRecipeBookDoc must be called inside a RecipeBookDocContext.Provider");
  return doc;
}
