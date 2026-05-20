import { useState } from "react";
import { useUser } from "./hooks/useUser.js";
import { useYjsDoc } from "./hooks/useYjsDoc.js";
import { DocContext } from "./contexts/docContext.js";
import { NavMenu } from "./components/NavMenu.js";
import { UserMenu } from "./components/UserMenu.js";
import { SelectUserPage } from "./pages/SelectUserPage.js";
import { ProfileSettingsPage } from "./pages/ProfileSettingsPage.js";
import { BulkIngredientEditorPage } from "./pages/BulkIngredientEditorPage.js";
import { RecipeEditorPage } from "./pages/RecipeEditorPage.js";

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
        <header className="top-nav">
          <NavMenu onNavigate={(page) => setRoute(page)} />
          <span className="app-title">Recipe Book</span>
          <div className="nav-right">
            <button className="undo-btn" aria-label="Undo">↩ Undo</button>
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
          <main className="page-content">
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
