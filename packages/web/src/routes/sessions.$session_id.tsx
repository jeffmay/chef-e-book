import { useParams } from "react-router";
import { RecipeSessionPage } from "../pages/RecipeSessionPage.tsx";

export default function RecipeSession() {
  const { session_id } = useParams();

  if (!session_id) return null;

  return <RecipeSessionPage sessionId={session_id} />;
}
