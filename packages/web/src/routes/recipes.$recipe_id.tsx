import { useNavigate, useParams } from "react-router";
import { useRecipeStore } from "../hooks/useRecipeStore.js";
import { RecipeEditor } from "../pages/RecipeEditorPage.js";

export default function RecipeDetail() {
  const { recipe_id } = useParams();
  const navigate = useNavigate();
  const { recipes } = useRecipeStore();

  if (!recipe_id) return null;

  const recipe = recipes.find((r) => r.id === recipe_id) ?? null;

  return (
    <RecipeEditor
      recipe={recipe}
      onSave={() => navigate("/recipes")}
      onCancel={() => navigate("/recipes")}
    />
  );
}
