import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useNavigate } from "react-router";
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
import { useRekeyBookNames } from "./hooks/useRekeyBookNames.ts";
import { BookDocContext } from "./contexts/docContext.ts";
import { BookUndoContext } from "./contexts/undoContext.ts";
import { useBookUndoManager } from "./hooks/useBookUndoManager.ts";
import { NavMenu } from "./components/NavMenu.tsx";
import { SelectBookPage } from "./pages/SelectBookPage.tsx";
import { setBookName, type RecipeBookId } from "@recipe-book/shared";

export type RootContext = ReadonlyDeep<{
  bookId: RecipeBookId;
  /** The open book's display name. */
  bookName: string;
  onRename: (name: string) => void;
  /** Deletes the open book from this device and returns to the book picker. */
  onDelete: () => void;
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
  /** Every book on this device, for the menu's "Switch Books" list. */
  books: BookRegistryEntry[];
  /** Leaves this book for the book picker. */
  onSwitchBook: () => void;
  /** Opens another book on this device directly. */
  onOpenBook: (id: RecipeBookId) => void;
  /** The book's own document renamed it (here, on another device, or by an undo). */
  onBookNameChange: (id: RecipeBookId, name: string) => void;
  /** Deletes the open book from this device, returning to the book picker. */
  onDeleteBook: (id: RecipeBookId) => void;
}>;

function AuthenticatedShell({
  book,
  books,
  onSwitchBook,
  onOpenBook,
  onBookNameChange,
  onDeleteBook,
}: AuthenticatedShellProps) {
  const bookDoc = useBookDoc(book.id);
  // Seeding and re-keying record a flag in book_meta, so they wait for it to exist.
  const metaReady = useEnsureBookMeta(bookDoc, book);
  useSeedDefaultKitchenware(bookDoc, metaReady);
  useRekeyBookNames(bookDoc, metaReady);
  useSyncBookName(bookDoc, book, onBookNameChange);
  // One history for the whole book; it lives here so it survives page navigation.
  const bookUndo = useBookUndoManager(bookDoc.doc);
  // const navigate = useNavigate();

  // Renaming writes the book's own document, which keeps the book's id; the registry's cached name
  // follows through `useSyncBookName`.
  const { doc } = bookDoc;
  const onRename = useCallback((name: string) => setBookName(doc, name), [doc]);
  const bookId = book.id;
  const onDelete = useCallback(() => onDeleteBook(bookId), [onDeleteBook, bookId]);
  const outletContext = useMemo(
    () => ({ bookId, bookName: book.name, onRename, onDelete }) satisfies RootContext,
    [bookId, book.name, onRename, onDelete],
  );

  return (
    <BookDocContext.Provider value={bookDoc}>
      <BookUndoContext.Provider value={bookUndo}>
        <div className="app">
          <header className="top-nav">
            <NavMenu
              books={books}
              activeBookId={book.id}
              onSwitchBook={onSwitchBook}
              onOpenBook={onOpenBook}
            />
            <h1 className="book-name">{book.name}</h1>
            <div className="nav-right">
              <button
                className="undo-btn"
                aria-label="Undo"
                onClick={bookUndo.undo}
                disabled={!bookUndo.canUndo}
              >
                {bookUndo.canUndo ? "↩ Undo" : "✕ Undo"}
              </button>
              {/* TODO: Add this back once we have user authentication */}
              {/* <UserMenu userName={unknown} onProfile={() => navigate("/profile")} /> */}
            </div>
          </header>
          <Outlet context={outletContext} />
        </div>
      </BookUndoContext.Provider>
    </BookDocContext.Provider>
  );
}

export default function Root() {
  const { books, activeBook, createBook, openBook, closeBook, renameBook, deleteBook } =
    useBookRegistry();
  const navigate = useNavigate();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // The open book's database is held open by this tab, so its data cannot be deleted until the
  // book has closed. The id waits here until the picker is showing, then the effect deletes it.
  const pendingDeleteId = useRef<RecipeBookId | null>(null);

  useEffect(() => {
    const id = pendingDeleteId.current;
    if (id === null || activeBook !== null) return;
    pendingDeleteId.current = null;
    deleteBook(id).catch((e: unknown) => {
      // The book stays listed, so the delete can be tried again from the picker.
      setDeleteError(`Could not delete the book: ${e instanceof Error ? e.message : String(e)}`);
    });
  }, [activeBook, deleteBook]);

  const deleteOpenBook = useCallback(
    (id: RecipeBookId) => {
      setDeleteError(null);
      pendingDeleteId.current = id;
      closeBook();
      // Leave the deleted book's settings URL, so the next book opened does not land on it.
      void navigate("/");
    },
    [closeBook, navigate],
  );

  if (activeBook === null) {
    return (
      <SelectBookPage
        books={books}
        error={deleteError}
        onOpen={(id) => {
          setDeleteError(null);
          openBook(id);
        }}
        onCreate={(name) => {
          setDeleteError(null);
          createBook(name);
        }}
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
      books={books}
      onSwitchBook={closeBook}
      onOpenBook={openBook}
      onBookNameChange={renameBook}
      onDeleteBook={deleteOpenBook}
    />
  );
}
