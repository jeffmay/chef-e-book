import type { Ingredient, KitchenwareLabel, KitchenwareLabelId } from "@recipe-book/shared";
import { RadioButton } from "primereact/radiobutton";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { ReadonlyDeep } from "type-fest";
import { AcceptOrCancelEditor } from "../accept_or_cancel_editor/AcceptOrCancelEditor.tsx";
import { Modal } from "../modal/Modal.tsx";
import "./LabelTable.css";

export type LabelTableProps = ReadonlyDeep<{
  labels: readonly KitchenwareLabel[];
  ingredients: readonly Ingredient[];
  onFilterAll: (label_ids: readonly KitchenwareLabelId[]) => void;
  onFilterAny: (label_ids: readonly KitchenwareLabelId[]) => void;
  /** @default calls onFilterAll([]) */
  onClearFilters?: () => void;
  onDelete: (label_ids: readonly KitchenwareLabelId[]) => void;
  onMerge: (label_ids: readonly KitchenwareLabelId[], new_name: string) => void;
  onRename: (id: KitchenwareLabelId, name: string) => void;
  /**
   * Why `name` cannot be used (another label already has it), or `undefined` if it can. `exclude`
   * is the label being renamed, or the labels being merged: they never clash with the new name.
   * While it returns a message, the rename or merge shows it and is not committed.
   */
  nameError?: (name: string, exclude: readonly KitchenwareLabelId[]) => string | undefined;
}>;

export function LabelTable({
  labels,
  ingredients,
  onFilterAll,
  onFilterAny,
  onClearFilters = () => onFilterAll([]),
  onDelete,
  onMerge,
  onRename,
  nameError,
}: LabelTableProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<KitchenwareLabelId>>(new Set());
  const [filterMode, setFilterMode] = useState<"all" | "any" | null>(null);
  const [mergeName, setMergeName] = useState("");
  const [showMergeInput, setShowMergeInput] = useState(false);
  const [editingId, setEditingId] = useState<KitchenwareLabelId | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteBtnRef = useRef<HTMLButtonElement>(null);

  // Per-label timers used to debounce name-cell clicks so that a single click
  // (select) and a double-click (rename) are distinguishable.  Using a Map lets
  // rapid clicks on *different* labels each keep their own pending timer.
  const clickTimersRef = useRef<Map<KitchenwareLabelId, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => {
    const timers = clickTimersRef.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const selectedArray = [...selectedIds];
  const allSelected = labels.length > 0 && labels.every((l) => selectedIds.has(l.id));
  const someSelected = labels.some((l) => selectedIds.has(l.id));

  function clearSelection(): void {
    setSelectedIds(new Set());
    if (filterMode !== null) {
      setFilterMode(null);
      onClearFilters();
    }
  }

  function toggle(id: KitchenwareLabelId): void {
    const isLastSelected = selectedIds.size === 1 && selectedIds.has(id);
    if (isLastSelected) {
      clearSelection();
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(): void {
    if (allSelected) {
      clearSelection();
    } else {
      setSelectedIds(new Set(labels.map((l) => l.id)));
    }
  }

  function handleFilterOff(): void {
    setFilterMode(null);
    onClearFilters();
  }

  function handleFilterAll(): void {
    setFilterMode("all");
    onFilterAll(selectedArray);
  }

  function handleFilterAny(): void {
    setFilterMode("any");
    onFilterAny(selectedArray);
  }

  function handleDeleteClick(): void {
    setShowDeleteConfirm(true);
  }

  function handleDeleteConfirm(): void {
    onDelete(selectedArray);
    clearSelection();
    setShowDeleteConfirm(false);
  }

  function handleDeleteCancel(): void {
    setShowDeleteConfirm(false);
    deleteBtnRef.current?.focus();
  }

  const affectedIngredients = useMemo(
    () => ingredients.filter((ing) => [...selectedIds].some((id) => ing.labels.has(id))),
    [ingredients, selectedIds],
  );

  const mergeError =
    mergeName.trim() === "" ? undefined : nameError?.(mergeName.trim(), selectedArray);
  const editingError =
    editingId === null || editingName.trim() === ""
      ? undefined
      : nameError?.(editingName.trim(), [editingId]);

  function submitMerge(): void {
    const name = mergeName.trim();
    if (name === "" || selectedArray.length < 2 || mergeError !== undefined) return;
    onMerge(selectedArray, name);
    setMergeName("");
    setShowMergeInput(false);
    clearSelection();
  }

  function handleMergeSubmit(e: FormEvent): void {
    e.preventDefault();
    submitMerge();
  }

  function cancelMerge(): void {
    setShowMergeInput(false);
    setMergeName("");
  }

  function beginEdit(label: ReadonlyDeep<KitchenwareLabel>): void {
    setEditingId(label.id);
    setEditingName(label.name);
  }

  function commitEdit(): void {
    const name = editingName.trim();
    // A name that is taken keeps the editor open, with its message showing, instead of renaming.
    if (editingError !== undefined) return;
    if (name !== "" && editingId !== null) {
      onRename(editingId, name);
    }
    setEditingId(null);
    setEditingName("");
  }

  function cancelEdit(): void {
    setEditingId(null);
    setEditingName("");
  }

  return (
    <section className="label-table-section" aria-label="Labels">
      <button
        type="button"
        className="label-table-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="label-table-panel"
      >
        <span className="label-table-toggle-icon" aria-hidden>
          {expanded ? "▼" : "▶"}
        </span>
        Labels
        {labels.length > 0 && (
          <span className="label-table-count" aria-label={`${labels.length} labels`}>
            {labels.length}
          </span>
        )}
      </button>

      {expanded && (
        <div id="label-table-panel" className="label-table-panel">
          {/* Bulk action bar */}
          {someSelected && (
            <div className="label-table-bulk-bar" role="region" aria-label="Label bulk actions">
              <button
                type="button"
                className="label-table-bulk-btn label-table-bulk-clear"
                onClick={clearSelection}
              >
                Clear
              </button>
              <span className="label-table-bulk-count">{selectedIds.size} selected</span>
              <span className="label-table-filter-label">Filter:</span>
              <div className="label-table-filter-group" role="group" aria-label="Filter mode">
                <label
                  htmlFor="label-table-filter-off"
                  className={`label-table-filter-btn${filterMode === null ? " label-table-filter-btn--active" : ""}`}
                >
                  <RadioButton
                    inputId="label-table-filter-off"
                    name="lt_filter_mode"
                    value="off"
                    checked={filterMode === null}
                    onChange={handleFilterOff}
                  />
                  Off
                </label>
                <label
                  htmlFor="label-table-filter-all"
                  className={`label-table-filter-btn${filterMode === "all" ? " label-table-filter-btn--active" : ""}`}
                >
                  <RadioButton
                    inputId="label-table-filter-all"
                    name="lt_filter_mode"
                    value="all"
                    checked={filterMode === "all"}
                    onChange={handleFilterAll}
                  />
                  All
                </label>
                <label
                  htmlFor="label-table-filter-any"
                  className={`label-table-filter-btn${filterMode === "any" ? " label-table-filter-btn--active" : ""}`}
                >
                  <RadioButton
                    inputId="label-table-filter-any"
                    name="lt_filter_mode"
                    value="any"
                    checked={filterMode === "any"}
                    onChange={handleFilterAny}
                  />
                  Any
                </label>
              </div>
              <button
                ref={deleteBtnRef}
                type="button"
                className="label-table-bulk-btn"
                onClick={handleDeleteClick}
                aria-label="Delete selected labels"
              >
                Delete
              </button>
              {selectedArray.length >= 2 && (
                <>
                  {showMergeInput ? (
                    <AcceptOrCancelEditor
                      cancelLabel="Cancel merge"
                      acceptLabel="Confirm merge"
                      onCancel={cancelMerge}
                      onAccept={submitMerge}
                    >
                      <form className="label-table-merge-form" onSubmit={handleMergeSubmit}>
                        <input
                          type="text"
                          className="label-table-merge-input"
                          value={mergeName}
                          onChange={(e) => setMergeName(e.target.value)}
                          placeholder="Merged label name…"
                          id="label-table-merge-name"
                          aria-label="Merged label name"
                          aria-invalid={mergeError !== undefined}
                          autoFocus
                        />
                        {mergeError !== undefined && (
                          <span className="field-error" role="alert">
                            {mergeError}
                          </span>
                        )}
                        <button
                          type="submit"
                          className="label-table-bulk-btn"
                          disabled={mergeName.trim() === "" || mergeError !== undefined}
                          aria-label="Confirm merge"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          className="label-table-bulk-btn"
                          onClick={cancelMerge}
                          aria-label="Cancel merge"
                        >
                          Cancel
                        </button>
                      </form>
                    </AcceptOrCancelEditor>
                  ) : (
                    <button
                      type="button"
                      className="label-table-bulk-btn"
                      onClick={() => setShowMergeInput(true)}
                      aria-label="Merge selected labels"
                    >
                      Merge
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {showDeleteConfirm && (
            <Modal
              title={`Delete ${selectedIds.size} label${selectedIds.size !== 1 ? "s" : ""}?`}
              ariaLabel="Confirm delete labels"
              buttons={{
                cancel: {
                  text: "↩ Cancel",
                  dangerous: false,
                  onClick: handleDeleteCancel,
                  ariaLabel: "Cancel delete",
                },
                delete: {
                  text: "✔︎ Delete",
                  dangerous: true,
                  onClick: handleDeleteConfirm,
                  ariaLabel: "Confirm delete",
                },
              }}
              onEnterClickId="cancel"
              onClose={() => {
                handleDeleteCancel();
                return true;
              }}
            >
              {affectedIngredients.length > 0 ? (
                <>
                  <p className="label-table-delete-subtitle">
                    The following ingredient{affectedIngredients.length !== 1 ? "s" : ""} will be
                    affected:
                  </p>
                  <ul className="label-table-delete-list">
                    {affectedIngredients.map((ing) => (
                      <li key={ing.id}>{ing.name}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="label-table-delete-subtitle">No ingredients use these labels.</p>
              )}
            </Modal>
          )}

          {labels.length === 0 ? (
            <p className="label-table-empty">No labels yet.</p>
          ) : (
            <table className="label-table-table" aria-label="Label list">
              <thead>
                <tr>
                  <th className="label-table-th label-table-th--select">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected && !allSelected;
                      }}
                      onChange={toggleAll}
                      id="label-table-select-all"
                      aria-label="Select all labels"
                    />
                  </th>
                  <th className="label-table-th">Name</th>
                  <th className="label-table-th">Used for</th>
                </tr>
              </thead>
              <tbody>
                {labels.map((label) => (
                  <tr
                    key={label.id}
                    className={`label-table-row${selectedIds.has(label.id) ? " label-table-row--selected" : ""}`}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.tagName === "INPUT" || target.closest("button") !== null) return;
                      toggle(label.id);
                    }}
                  >
                    <td className="label-table-td label-table-td--select">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(label.id)}
                        onChange={() => toggle(label.id)}
                        id={`label-table-select-${label.id}`}
                        aria-label={`Select label ${label.name}`}
                      />
                    </td>
                    <td className="label-table-td">
                      {editingId === label.id ? (
                        <AcceptOrCancelEditor
                          cancelLabel="Cancel rename"
                          acceptLabel="Confirm rename"
                          onCancel={cancelEdit}
                          onAccept={commitEdit}
                        >
                          <span className="label-table-editing">
                            <input
                              type="text"
                              className="label-table-edit-input"
                              value={editingName}
                              autoFocus
                              id={`label-table-edit-name-${label.id}`}
                              aria-label={`Edit label name ${label.name}`}
                              aria-invalid={editingError !== undefined}
                              onChange={(e) => setEditingName(e.target.value)}
                            />
                            {editingError !== undefined && (
                              <span className="field-error" role="alert">
                                {editingError}
                              </span>
                            )}
                            <button
                              type="button"
                              className="label-table-edit-btn"
                              onClick={cancelEdit}
                              aria-label="Cancel rename"
                            >
                              ↩
                            </button>
                            <button
                              type="button"
                              className="label-table-edit-btn"
                              onClick={commitEdit}
                              aria-label="Confirm rename"
                            >
                              ✔︎
                            </button>
                          </span>
                        </AcceptOrCancelEditor>
                      ) : (
                        <span
                          className="label-table-name"
                          role="button"
                          tabIndex={0}
                          aria-label={`Rename label ${label.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Delay the selection action so a rapid second click can cancel it.
                            // A dblclick fires two click events before the dblclick event; without
                            // this debounce the row would toggle twice (net no-op) and the editor
                            // would open in an unintentionally modified selection state.
                            const timers = clickTimersRef.current;
                            const existing = timers.get(label.id);
                            if (existing !== undefined) clearTimeout(existing);
                            timers.set(
                              label.id,
                              setTimeout(() => {
                                timers.delete(label.id);
                                toggle(label.id);
                              }, 250),
                            );
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            // Cancel the pending single-click selection so the row is not
                            // inadvertently toggled.  Selecting and editing are separate
                            // operations; opening the editor does not implicitly select the row.
                            const timers = clickTimersRef.current;
                            const existing = timers.get(label.id);
                            if (existing !== undefined) {
                              clearTimeout(existing);
                              timers.delete(label.id);
                            }
                            beginEdit(label);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggle(label.id);
                            }
                            if (e.key === "F2") beginEdit(label);
                          }}
                        >
                          {label.name}
                        </span>
                      )}
                    </td>
                    <td className="label-table-td label-table-td--kinds">
                      {[...label.kinds].join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
