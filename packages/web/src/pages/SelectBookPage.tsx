import { useState, type FormEvent } from "react";
import type { ReadonlyDeep } from "type-fest";
import type { RecipeBookId } from "@recipe-book/shared";
import { AcceptOrCancelEditor } from "../components/accept_or_cancel_editor/AcceptOrCancelEditor.tsx";
import { EditActions } from "../components/edit_actions/EditActions.tsx";
import { Modal } from "../components/modal/Modal.tsx";
import { EditButton } from "../components/row_actions/EditButton.tsx";
import { RemoveButton } from "../components/row_actions/RemoveButton.tsx";
import type { BookRegistryEntry } from "../storage/bookRegistry.ts";
import "./SelectBookPage.css";

type SelectBookPageProps = ReadonlyDeep<{
  /** The books on this device, in the order to show them. */
  books: BookRegistryEntry[];
  onOpen: (id: RecipeBookId) => void;
  onCreate: (name: string) => void;
  onRename: (id: RecipeBookId, name: string) => void | Promise<void>;
  onDelete: (id: RecipeBookId) => void | Promise<void>;
}>;

export function SelectBookPage({
  books,
  onOpen,
  onCreate,
  onRename,
  onDelete,
}: SelectBookPageProps) {
  const [name, setName] = useState("");
  const [renamingId, setRenamingId] = useState<RecipeBookId | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleting, setDeleting] = useState<BookRegistryEntry | null>(null);

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed !== "") onCreate(trimmed);
  }

  function startRename(book: ReadonlyDeep<BookRegistryEntry>) {
    setRenamingId(book.id);
    setRenameDraft(book.name);
  }

  function acceptRename(book: ReadonlyDeep<BookRegistryEntry>) {
    const trimmed = renameDraft.trim();
    setRenamingId(null);
    if (trimmed !== "" && trimmed !== book.name) void Promise.resolve(onRename(book.id, trimmed));
  }

  return (
    <main className="select-user-page">
      <h1 className="page-title">{name || "Recipe Book"}</h1>

      {books.length > 0 && (
        <section className="book-list-section" aria-labelledby="book-list-heading">
          <h2 id="book-list-heading" className="book-list-heading">
            Your books
          </h2>
          <ul className="book-list">
            {books.map((book) => (
              <li key={book.id} className="book-row">
                {renamingId === book.id ? (
                  <AcceptOrCancelEditor
                    autoFocus
                    cancelLabel={`Cancel renaming ${book.name}`}
                    acceptLabel={`Accept new name for ${book.name}`}
                    onCancel={() => setRenamingId(null)}
                    onAccept={() => acceptRename(book)}
                  >
                    <input
                      className="book-rename-input"
                      type="text"
                      aria-label={`New name for ${book.name}`}
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                    />
                    <EditActions />
                  </AcceptOrCancelEditor>
                ) : (
                  <>
                    <EditButton
                      label={`Rename book ${book.name}`}
                      onClick={() => startRename(book)}
                    />
                    <button
                      type="button"
                      className="book-open"
                      aria-label={`Open book ${book.name}`}
                      onClick={() => onOpen(book.id)}
                    >
                      {book.name}
                    </button>
                  </>
                )}
                <RemoveButton
                  label={`Delete book ${book.name}`}
                  onClick={() => setDeleting({ ...book })}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="select-user-subtitle">
        {books.length > 0 ? "Or start a new book." : "Enter the name of your book to get started."}
      </p>
      <form className="select-user-form" onSubmit={handleCreate}>
        <label className="select-user-label" htmlFor="user-name-input">
          Book name
        </label>
        <input
          id="user-name-input"
          className="select-user-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus={books.length === 0}
          autoComplete="off"
        />
        <button type="submit" className="select-user-submit" disabled={name.trim() === ""}>
          Create book
        </button>
      </form>

      {deleting !== null && (
        <Modal
          title={`Delete "${deleting.name}"?`}
          onClose={() => {
            setDeleting(null);
            return true;
          }}
          onEnterClickId="cancel"
          buttons={{
            cancel: { text: "Cancel", dangerous: false, onClick: () => setDeleting(null) },
            delete: {
              text: "Delete book",
              dangerous: true,
              onClick: () => {
                const book = deleting;
                setDeleting(null);
                void Promise.resolve(onDelete(book.id));
              },
            },
          }}
        >
          <p>
            This removes the book, with all of its recipes and ingredients, from this device. It
            cannot be undone.
          </p>
        </Modal>
      )}
    </main>
  );
}
