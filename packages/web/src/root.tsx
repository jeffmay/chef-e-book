import { type ReactNode } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { ReadonlyDeep } from "type-fest";
import "primereact/resources/themes/lara-light-indigo/theme.css";
import "primereact/resources/primereact.css";
import "primeicons/primeicons.css";
import "./styles/global.css";
import type { ActiveBookMeta } from "./hooks/useActiveBookMetaStore.ts";
import { useActiveBookMeta } from "./hooks/useActiveBookMetaStore.ts";
import { useBookDoc } from "./hooks/useYjsDoc.ts";
import { useEnsureBookMeta } from "./hooks/useEnsureBookMeta.ts";
import { useSeedDefaultKitchenware } from "./hooks/useSeedDefaultKitchenware.ts";
import { BookDocContext } from "./contexts/docContext.ts";
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
  const bookDoc = useBookDoc(book.id);
  // Order matters: book_meta must exist before the seeded flag is recorded in it.
  useEnsureBookMeta(bookDoc, book);
  useSeedDefaultKitchenware(bookDoc);
  // const navigate = useNavigate();

  return (
    <BookDocContext.Provider value={bookDoc}>
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
    </BookDocContext.Provider>
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
