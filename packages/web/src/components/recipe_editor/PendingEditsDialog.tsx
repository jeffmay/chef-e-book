import type { ReadonlyDeep } from "type-fest";
import { Modal } from "../modal/Modal.tsx";

export type PendingEditsDialogProps = ReadonlyDeep<{
  /** How many rows still hold uncommitted changes. */
  count: number;
  onAcceptAll: () => void;
  onDiscardAll: () => void;
  onCancel: () => void;
}>;

/**
 * Asked before saving when instruction or container rows are still open with
 * uncommitted drafts, so a page-level save never drops them silently. Escape
 * (and Enter) take the safe way out: cancel the save and leave the drafts alone.
 */
export function PendingEditsDialog({
  count,
  onAcceptAll,
  onDiscardAll,
  onCancel,
}: PendingEditsDialogProps) {
  return (
    <Modal
      title="Unsaved changes"
      ariaLabel="Unsaved row changes"
      buttons={{
        accept_all: { text: "Accept all changes", dangerous: false, onClick: onAcceptAll },
        discard_all: { text: "Discard all changes", dangerous: true, onClick: onDiscardAll },
        cancel: { text: "Cancel", dangerous: false, onClick: onCancel },
      }}
      onEnterClickId="cancel"
      onClose={() => {
        onCancel();
        return true;
      }}
    >
      <p>
        {count} row{count !== 1 ? "s are" : " is"} still open for editing. Accept those changes into
        the recipe before saving, or discard them?
      </p>
    </Modal>
  );
}
