import { useState } from "react";
import type { ReadonlyDeep } from "type-fest";
import { AcceptOrCancelEditor } from "../components/accept_or_cancel_editor/AcceptOrCancelEditor.tsx";
import { DeleteBookModal } from "../components/delete_book_modal/DeleteBookModal.tsx";
import { EditActions } from "../components/edit_actions/EditActions.tsx";
import "./BookSettingsPage.css";

type BookSettingsPageProps = ReadonlyDeep<{
  /** The open book's current name. */
  bookName: string;
  /** Renames the open book. Only called with a trimmed, non-empty name that differs from the current one. */
  onRename: (name: string) => void;
  /** Deletes the open book from this device and returns to the book picker. */
  onDelete: () => void;
}>;

/** Settings for the open book: renaming it, and deleting it from this device. */
export function BookSettingsPage({ bookName, onRename, onDelete }: BookSettingsPageProps) {
  // `null` means "show the book's current name", so a rename from elsewhere (an undo, another
  // device) shows up here instead of being masked by a stale draft.
  const [draft, setDraft] = useState<string | null>(null);
  const [blankName, setBlankName] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function cancelRename() {
    setDraft(null);
    setBlankName(false);
  }

  function acceptRename() {
    const trimmed = (draft ?? bookName).trim();
    if (trimmed === "") {
      setBlankName(true);
      return;
    }
    if (trimmed !== bookName) onRename(trimmed);
    cancelRename();
  }

  return (
    <main className="book-settings-page">
      <h1 className="page-title">Book Settings</h1>

      <section className="book-settings-section" aria-labelledby="book-settings-name-heading">
        <h2 id="book-settings-name-heading" className="book-settings-heading">
          Name
        </h2>
        <AcceptOrCancelEditor
          cancelLabel="Cancel renaming the book"
          acceptLabel="Accept the new book name"
          onCancel={cancelRename}
          onAccept={acceptRename}
        >
          <div className="book-settings-rename">
            <label className="book-settings-label" htmlFor="book-settings-name-input">
              Book name
              <span className="field-required" aria-hidden="true">
                {" *"}
              </span>
            </label>
            <input
              id="book-settings-name-input"
              className={`book-settings-input${blankName ? " field-input--error" : ""}`}
              type="text"
              value={draft ?? bookName}
              aria-required="true"
              aria-invalid={blankName || undefined}
              autoComplete="off"
              onChange={(e) => {
                setDraft(e.target.value);
                setBlankName(false);
              }}
            />
            {blankName && (
              <p className="field-error" role="alert">
                The book needs a name.
              </p>
            )}
            <EditActions />
          </div>
        </AcceptOrCancelEditor>
      </section>

      <section className="book-settings-section" aria-labelledby="book-settings-delete-heading">
        <h2 id="book-settings-delete-heading" className="book-settings-heading">
          Delete book
        </h2>
        <p className="book-settings-help">
          Removes this book, with all of its recipes and ingredients, from this device.
        </p>
        <button
          type="button"
          className="book-settings-delete"
          onClick={() => setConfirmingDelete(true)}
        >
          Delete this book
        </button>
      </section>

      {confirmingDelete && (
        <DeleteBookModal
          bookName={bookName}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => {
            setConfirmingDelete(false);
            onDelete();
          }}
        />
      )}
    </main>
  );
}
