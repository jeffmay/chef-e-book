import { createContext, useContext } from "react";

/** Undo and redo for the open book. See `useBookUndoManager`. */
export interface BookUndo {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /**
   * Ends the current undo step, so the next edit starts a new one instead of merging into the last
   * (edits within half a second of each other otherwise undo together).
   */
  stopCapturing: () => void;
  /**
   * Runs `fn` as exactly one undo step that never merges with the edit before or after it
   * (`runAsUndoStep`). Used for an import.
   */
  runAsStep: <T>(fn: () => T) => T;
}

export const BookUndoContext = createContext<BookUndo | null>(null);

export function useBookUndo(): BookUndo {
  const undo = useContext(BookUndoContext);
  if (undo === null) {
    throw new Error("useBookUndo must be called inside a BookUndoContext.Provider");
  }
  return undo;
}

/** Like `useBookUndo`, but `null` outside a provider, for code that works with or without a book shell. */
export function useOptionalBookUndo(): BookUndo | null {
  return useContext(BookUndoContext);
}
