import { RecipeFolderId, loadId } from "@recipe-book/shared";
import type { Recipe } from "@recipe-book/shared";
import { useLocation, useNavigate } from "react-router";
import { RecipeEditor } from "../pages/RecipeEditorPage.tsx";

function parseParentFolderId(state: unknown): RecipeFolderId | undefined {
  if (typeof state !== "object" || state === null) return undefined;
  const v = (state as Record<string, unknown>)["parentFolderId"];
  return typeof v === "string" ? loadId(RecipeFolderId, v) : undefined;
}

export default function RecipesNew() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialFolderId = parseParentFolderId(location.state);

  return (
    <RecipeEditor
      recipe={null}
      {...(initialFolderId !== undefined ? { initialFolderId } : {})}
      onSave={(recipe: Recipe) => navigate(`/recipes/${recipe.id}`)}
      onCancel={() => navigate("/recipes")}
    />
  );
}
