import { createContext, useContext } from "react";
import * as Y from "yjs";

export const KitchenwareDocContext = createContext<Y.Doc | null>(null);
export const RecipeBookDocContext = createContext<Y.Doc | null>(null);

export function useKitchenwareDoc(): Y.Doc {
  const doc = useContext(KitchenwareDocContext);
  if (doc === null)
    throw new Error("useKitchenwareDoc must be called inside a KitchenwareDocContext.Provider");
  return doc;
}

export function useRecipeBookDoc(): Y.Doc {
  const doc = useContext(RecipeBookDocContext);
  if (doc === null)
    throw new Error("useRecipeBookDoc must be called inside a RecipeBookDocContext.Provider");
  return doc;
}

/** @deprecated Use useKitchenwareDoc instead */
export const useDoc = useKitchenwareDoc;
/** @deprecated Use KitchenwareDocContext instead */
export const DocContext = KitchenwareDocContext;
}

export function useRecipeBookDoc(): Y.Doc {
  const doc = useContext(RecipeBookDocContext);
  if (doc === null)
    throw new Error("useRecipeBookDoc must be called inside a RecipeBookDocContext.Provider");
  return doc;
}

/** @deprecated Use useKitchenwareDoc instead */
export const useDoc = useKitchenwareDoc;
/** @deprecated Use KitchenwareDocContext instead */
export const DocContext = KitchenwareDocContext;
