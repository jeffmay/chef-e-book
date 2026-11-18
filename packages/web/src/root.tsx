import { type ReactNode } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { ReadonlyDeep } from "type-fest";
import "primereact/resources/themes/lara-light-indigo/theme.css";
import "primereact/resources/primereact.css";
import "primeicons/primeicons.css";
import "./styles/global.css";
import { type BookRegistryEntry } from "./storage/bookRegistry.ts";
import { useBookRegistry } from "./hooks/useBookRegistry.ts";
import { useSyncBookName } from "./hooks/useSyncBookName.ts";
import { writeBookName } from "./storage/bookDatabases.ts";
import { useBookDoc } from "./hooks/useYjsDoc.ts";
import { useEnsureBookMeta } from "./hooks/useEnsureBookMeta.ts";
import { useSeedDefaultKitchenware } from "./hooks/useSeedDefaultKitchenware.ts";
import { BookDocContext } from "./contexts/docContext.ts";
import { BookUndoContext } from "./contexts/undoContext.ts";
import { useBookUndoManager } from "./hooks/useBookUndoManager.ts";
import { NavMenu } from "./components/NavMenu.tsx";
import { SelectBookPage } from "./pages/SelectBookPage.tsx";
import { setBookName, type RecipeBookId } from "@recipe-book/shared";

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
  book: BookRegistryEntry;
  /** Leaves this book for the book picker. */
  onSwitchBook: () => void;
  /** The book's own document renamed it (here, on another device, or by an undo). */
  onBookNameChange: (id: RecipeBookId, name: string) => void;
}>;

function AuthenticatedShell({ book, onSwitchBook, onBookNameChange }: AuthenticatedShellProps) {
  const bookDoc = useBookDoc(book.id);
  // Order matters: book_meta must exist before the seeded flag is recorded in it.
  useEnsureBookMeta(bookDoc, book);
  useSeedDefaultKitchenware(bookDoc);
  useSyncBookName(bookDoc, book, onBookNameChange);
  // One history for the whole book; it lives here so it survives page navigation.
  const bookUndo = useBookUndoManager(bookDoc.doc);
  // const navigate = useNavigate();

  // Renaming writes the book's own document, which keeps the book's id; the registry's cached name
  // follows through `useSyncBookName`.
  const onRename = (name: string) => setBookName(bookDoc.doc, name);

  return (
    <BookDocContext.Provider value={bookDoc}>
      <BookUndoContext.Provider value={bookUndo}>
        <div className="app">
          <header className="top-nav">
            <NavMenu />
            <h1 className="book-name">{book.name}</h1>
            <div className="nav-right">
              <button className="switch-book-btn" onClick={onSwitchBook}>
                Books
              </button>
              <button
                className="undo-btn"
                aria-label="Undo"
                onClick={bookUndo.undo}
                disabled={!bookUndo.canUndo}
              >
                ↩ Undo
              </button>
              {/* TODO: Add this back once we have user authentication */}
              {/* <UserMenu userName={unknown} onProfile={() => navigate("/profile")} /> */}
            </div>
          </header>
          <Outlet context={{ bookId: book.id, onRename } satisfies RootContext} />
        </div>
      </BookUndoContext.Provider>
    </BookDocContext.Provider>
  );
}

export default function Root() {
  const { books, activeBook, createBook, openBook, closeBook, renameBook, deleteBook } =
    useBookRegistry();

  if (activeBook === null) {
    return (
      <SelectBookPage
        books={books}
        onOpen={openBook}
        onCreate={createBook}
        onRename={async (id, name) => {
          // The book's own document leads; the registry caches its name.
          await writeBookName(id, name);
          renameBook(id, name);
        }}
        onDelete={deleteBook}
      />
    );
  }

  return (
    <AuthenticatedShell
      key={activeBook.id}
      book={activeBook}
      onSwitchBook={closeBook}
      onBookNameChange={renameBook}
    />
  );
}
