import { useOutletContext } from "react-router";
import { RecipeEditorPage } from "../pages/RecipeEditorPage.js";
import type { RootContext } from "../root.js";

export default function Recipes() {
  const { userName } = useOutletContext<RootContext>();
  return <RecipeEditorPage userName={userName} />;
}
