import {
  type ItemState,
  type RecipeId,
  type RecipeVersionId,
  type Session,
  type SessionId,
  completeSession,
  createSession,
  getItemStatesYmap,
  getSessionYmap,
  getSessions,
  updateSessionItemState,
} from "@recipe-book/shared";
import { useEffect, useState } from "react";
import { useRecipeBookDoc } from "../contexts/docContext.ts";

export interface SessionStore {
  readonly sessions: Session[];
  readonly start: (recipeId: RecipeId, versionId: RecipeVersionId) => Session;
  readonly updateItemState: (
    sessionId: SessionId,
    itemId: string,
    patch: Partial<ItemState>,
  ) => Session;
  readonly complete: (sessionId: SessionId, allItemIds: readonly string[]) => Session;
}

export function useSessionStore(): SessionStore {
  const { doc, whenSynced } = useRecipeBookDoc();
  const [sessions, setSessions] = useState<Session[]>(() => getSessions(doc));

  useEffect(() => {
    const sessionsMap = getSessionYmap(doc);
    const itemStatesMap = getItemStatesYmap(doc);
    function update() {
      setSessions(getSessions(doc));
    }
    sessionsMap.observe(update);
    itemStatesMap.observe(update);
    whenSynced.then(() => setSessions(getSessions(doc)));
    return () => {
      sessionsMap.unobserve(update);
      itemStatesMap.unobserve(update);
    };
  }, [doc, whenSynced]);

  return {
    sessions,
    start: (recipeId, versionId) => createSession(doc, recipeId, versionId),
    updateItemState: (sessionId, itemId, patch) =>
      updateSessionItemState(doc, sessionId, itemId, patch),
    complete: (sessionId, allItemIds) => completeSession(doc, sessionId, allItemIds),
  };
}
