import type { ReadonlyDeep } from "type-fest";
import { Modal } from "../modal/Modal.tsx";

type DeleteBookModalProps = ReadonlyDeep<{
  /** The name of the book about to be deleted. */
  bookName: string;
  /** Escape, the backdrop, or "Cancel": keep the book. */
  onCancel: () => void;
  /** "Delete book": the only way to go ahead. */
  onConfirm: () => void;
}>;

/**
 * The confirmation shown before a book is deleted from this device. Shared by the book picker and
 * the book settings page so both say the same thing: the delete is permanent here, and it does not
 * reach other devices. Enter is the safe choice — it cancels.
 */
export function DeleteBookModal({ bookName, onCancel, onConfirm }: DeleteBookModalProps) {
  return (
    <Modal
      title={`Delete "${bookName}"?`}
      onClose={() => {
        onCancel();
        return true;
      }}
      onEnterClickId="cancel"
      buttons={{
        cancel: { text: "Cancel", dangerous: false, onClick: onCancel },
        delete: { text: "Delete book", dangerous: true, onClick: onConfirm },
      }}
    >
      <p>
        This removes the book, with all of its recipes and ingredients, from this device. It cannot
        be undone on this device.
      </p>
      <p>
        It will not be deleted automatically from your other devices, or from any server it was
        synced to. Delete it there too if you no longer want it.
      </p>
    </Modal>
  );
}
