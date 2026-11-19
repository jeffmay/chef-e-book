import { createBookUndoManager, runAsUndoStep } from "@recipe-book/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as Y from "yjs";
import type { BookUndo } from "../contexts/undoContext.ts";

type UndoAvailability = { canUndo: boolean; canRedo: boolean };

const NOTHING_TO_UNDO: UndoAvailability = { canUndo: false, canRedo: false };

/**
 * One undo history for the open book, spanning its ingredients and its recipes (see
 * `createBookUndoManager`). Call it once, in the shell that owns the book's document: the history
 * then survives navigation between pages, and a different book — a different shell instance —
 * starts with an empty one.
 *
 * The manager is created in an effect, not during render, because it attaches listeners to the
 * document: creating it while rendering would leak one per StrictMode double-render.
 */
export function useBookUndoManager(doc: Y.Doc): BookUndo {
  const managerRef = useRef<Y.UndoManager | null>(null);
  const [availability, setAvailability] = useState<UndoAvailability>(NOTHING_TO_UNDO);

  useEffect(() => {
    const manager = createBookUndoManager(doc);
    managerRef.current = manager;
    function refresh() {
      const next = { canUndo: manager.canUndo(), canRedo: manager.canRedo() };
      // Keep the same object when nothing changed, so an edit that does not change what the Undo
      // button can do does not re-render everything that reads this context.
      setAvailability((prev) =>
        prev.canUndo === next.canUndo && prev.canRedo === next.canRedo ? prev : next,
      );
    }
    manager.on("stack-item-added", refresh);
    manager.on("stack-item-popped", refresh);
    manager.on("stack-cleared", refresh);
    return () => {
      manager.off("stack-item-added", refresh);
      manager.off("stack-item-popped", refresh);
      manager.off("stack-cleared", refresh);
      manager.destroy();
      managerRef.current = null;
      setAvailability(NOTHING_TO_UNDO);
    };
  }, [doc]);

  const undo = useCallback(() => {
    managerRef.current?.undo();
  }, []);
  const redo = useCallback(() => {
    managerRef.current?.redo();
  }, []);
  const stopCapturing = useCallback(() => {
    managerRef.current?.stopCapturing();
  }, []);

  const runAsStep = useCallback(
    <T>(fn: () => T): T => {
      const manager = managerRef.current;
      return manager === null ? doc.transact(fn) : runAsUndoStep(manager, doc, fn);
    },
    [doc],
  );

  return useMemo(
    () => ({ undo, redo, stopCapturing, runAsStep, ...availability }),
    [undo, redo, stopCapturing, runAsStep, availability],
  );
}
