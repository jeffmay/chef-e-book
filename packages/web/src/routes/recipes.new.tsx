import { useOutletContext, useNavigate } from "react-router";
import type { Recipe } from "@recipe-book/shared";
import { RecipeEditor } from "../pages/RecipeEditorPage.js";
import type { RootContext } from "../root.js";

export default function RecipesNew() {
  const { userName } = useOutletContext<RootContext>();
  const navigate = useNavigate();

  return (
    <RecipeEditor
      recipe={null}
      userName={userName}
      onSave={(recipe: Recipe) => navigate(`/recipes/${recipe.id}`)}
      onCancel={() => navigate("/recipes")}
    />
  );
}
