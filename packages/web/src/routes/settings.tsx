import { useOutletContext } from "react-router";
import { BookSettingsPage } from "../pages/BookSettingsPage.tsx";
import type { RootContext } from "../root.tsx";

export default function Settings() {
  const { bookName, onRename, onDelete } = useOutletContext<RootContext>();
  return <BookSettingsPage bookName={bookName} onRename={onRename} onDelete={onDelete} />;
}
