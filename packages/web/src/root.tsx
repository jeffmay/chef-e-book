import { type ReactNode } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { ReadonlyDeep } from "type-fest";
import "primereact/resources/themes/lara-light-indigo/theme.css";
import "primereact/resources/primereact.css";
import "primeicons/primeicons.css";
import "./styles/global.css";
import type { ActiveBookMeta } from "./hooks/useActiveBookMetaStore.ts";
import { useActiveBookMeta } from "./hooks/useActiveBookMetaStore.ts";
import { useKitchenwareDoc, useRecipeBookDoc } from "./hooks/useYjsDoc.ts";
import { KitchenwareDocContext, RecipeBookDocContext } from "./contexts/docContext.ts";
import { NavMenu } from "./components/NavMenu.tsx";
import { SelectBookPage } from "./pages/SelectBookPage.tsx";
import type { RecipeBookId } from "@recipe-book/shared";

export type RootContext = ReadonlyDeep<{
  bookId: RecipeBookId;
  onRename: (name: string) => void;
}>;

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Recipe Book</title>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

type AuthenticatedShellProps = ReadonlyDeep<{
  book: ActiveBookMeta;
  onRename: (name: string) => void;
}>;

function AuthenticatedShell({ book, onRename }: AuthenticatedShellProps) {
  const kitchenwareDoc = useKitchenwareDoc(book.id);
  const recipeBookDoc = useRecipeBookDoc(book.id);
  // const navigate = useNavigate();

  return (
    <KitchenwareDocContext.Provider value={kitchenwareDoc}>
      <RecipeBookDocContext.Provider value={recipeBookDoc}>
        <div className="app">
          <header className="top-nav">
            <NavMenu />
            <h1 className="book-name">{book.name}</h1>
            <div className="nav-right">
              <button className="undo-btn" aria-label="Undo">
                ↩ Undo
              </button>
              {/* TODO: Add this back once we have user authentication */}
              {/* <UserMenu userName={unknown} onProfile={() => navigate("/profile")} /> */}
            </div>
          </header>
          <Outlet context={{ bookId: book.id, onRename } satisfies RootContext} />
        </div>
      </RecipeBookDocContext.Provider>
    </KitchenwareDocContext.Provider>
  );
}

export default function Root() {
  const { activeBookMeta, setActiveBookName } = useActiveBookMeta();

  if (activeBookMeta === null) {
    return <SelectBookPage onSelect={setActiveBookName} />;
  }

  return (
    <AuthenticatedShell
      key={activeBookMeta.id}
      book={activeBookMeta}
      onRename={setActiveBookName}
    />
  );
}
