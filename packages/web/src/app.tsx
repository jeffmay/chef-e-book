import { useState } from "react";
import { useUser } from "./hooks/use_user.js";
import { useYjsDoc } from "./hooks/use_yjs_doc.js";
import { DocContext } from "./contexts/doc_context.js";
import { NavMenu } from "./components/nav_menu.js";
import { UserMenu } from "./components/user_menu.js";
import { SelectUserPage } from "./pages/select_user_page.js";
import { ProfileSettingsPage } from "./pages/profile_settings_page.js";
import { BulkIngredientEditorPage } from "./pages/bulk_ingredient_editor_page.js";
import { RecipeEditorPage } from "./pages/recipe_editor_page.js";

type Route = "home" | "profile_settings" | "bulk_ingredient_editor" | "recipe_editor";

interface AppContentProps {
  readonly userName: string;
  readonly onRename: (name: string) => void;
}

function AppContent({ userName, onRename }: AppContentProps) {
  const [route, setRoute] = useState<Route>("home");
  const doc = useYjsDoc(userName);

  function handleSaveProfile(name: string) {
    onRename(name);
    setRoute("home");
  }

  return (
    <DocContext.Provider value={doc}>
      <div className="app">
        <header className="top_nav">
          <NavMenu onNavigate={(page) => setRoute(page)} />
          <span className="app_title">Recipe Book</span>
          <div className="nav_right">
            <button className="undo_btn" aria-label="Undo">↩ Undo</button>
            <UserMenu
              userName={userName}
              onProfile={() => setRoute("profile_settings")}
            />
          </div>
        </header>

        {route === "profile_settings" ? (
          <ProfileSettingsPage
            currentName={userName}
            onSave={handleSaveProfile}
            onCancel={() => setRoute("home")}
          />
        ) : route === "bulk_ingredient_editor" ? (
          <BulkIngredientEditorPage />
        ) : route === "recipe_editor" ? (
          <RecipeEditorPage userName={userName} />
        ) : (
          <main className="page_content">
            <p className="placeholder">Your recipes will appear here.</p>
          </main>
        )}
      </div>
    </DocContext.Provider>
  );
}

export function App() {
  const { userName, setUserName } = useUser();

  if (userName === null) {
    return <SelectUserPage onSelect={setUserName} />;
  }

  return (
    <AppContent
      key={userName}
      userName={userName}
      onRename={setUserName}
    />
  );
}
