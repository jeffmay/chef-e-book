import { RecipeFolderId, loadId } from "@recipe-book/shared";
import type { Recipe } from "@recipe-book/shared";
import { useLocation, useNavigate } from "react-router";
import { RecipeEditor } from "../pages/RecipeEditorPage.tsx";

export default function RecipesNew() {
  const navigate = useNavigate();
  const location = useLocation();

  const rawState = location.state as Record<string, unknown> | null;
  const rawFolderId = rawState?.["parentFolderId"];
  const initialFolderId =
    typeof rawFolderId === "string" ? loadId(RecipeFolderId, rawFolderId) : undefined;

  return (
    <RecipeEditor
      recipe={null}
      {...(initialFolderId !== undefined ? { initialFolderId } : {})}
      onSave={(recipe: Recipe) => navigate(`/recipes/${recipe.id}`)}
      onCancel={() => navigate("/recipes")}
    />
  );
}
