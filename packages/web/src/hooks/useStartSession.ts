import type { RecipeId, RecipeVersionId } from "@recipe-book/shared";
import { useNavigate } from "react-router";
import { useSessionStore } from "./useSessionStore.ts";

/**
 * Returns a callback that starts a new session for a recipe version and
 * navigates to its RecipeSessionPage.
 */
export function useStartSession(): (recipeId: RecipeId, versionId: RecipeVersionId) => void {
  const navigate = useNavigate();
  const { start } = useSessionStore();

  return (recipeId, versionId) => {
    const session = start(recipeId, versionId);
    navigate(`/sessions/${session.id}`);
  };
}
