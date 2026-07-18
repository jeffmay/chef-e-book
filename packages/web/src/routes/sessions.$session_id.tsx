import { useParams } from "react-router";
import { RecipeSessionPage } from "../pages/RecipeSessionPage.tsx";

export default function RecipeSession() {
  const { sessionId } = useParams();

  if (!sessionId) return null;

  return <RecipeSessionPage sessionId={sessionId} />;
}
