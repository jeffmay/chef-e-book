import type { Recipe } from "@recipe-book/shared";
import { useNavigate } from "react-router";
import { RecipeEditor } from "../pages/RecipeEditorPage.js";

export default function RecipesNew() {
  const navigate = useNavigate();

  return (
    <RecipeEditor
      recipe={null}
      onSave={(recipe: Recipe) => navigate(`/recipes/${recipe.id}`)}
      onCancel={() => navigate("/recipes")}
    />
  );
}
