import { useOutletContext, useNavigate, useParams } from "react-router";
import { RecipeEditor } from "../pages/RecipeEditorPage.js";
import { useRecipeStore } from "../hooks/useRecipeStore.js";
import type { RootContext } from "../root.js";

export default function RecipeDetail() {
  const { recipe_id } = useParams();
  const { userName } = useOutletContext<RootContext>();
  const navigate = useNavigate();
  const { recipes } = useRecipeStore(userName);

  if (!recipe_id) return null;

  const recipe = recipes.find((r) => r.id === recipe_id) ?? null;

  return (
    <RecipeEditor
      recipe={recipe}
      userName={userName}
      onSave={() => navigate("/recipes")}
      onCancel={() => navigate("/recipes")}
    />
  );
}
