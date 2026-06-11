import type { Ingredient, KitchenwareLabel, KitchenwareLabelId } from "@recipe-book/shared";
import { RadioButton } from "primereact/radiobutton";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { ReadonlyDeep } from "type-fest";
import "./LabelTable.css";

export interface LabelTableProps {
  readonly labels: ReadonlyDeep<KitchenwareLabel[]>;
  readonly ingredients: ReadonlyDeep<Ingredient[]>;
  readonly onFilterAll: (label_ids: readonly KitchenwareLabelId[]) => void;
  readonly onFilterAny: (label_ids: readonly KitchenwareLabelId[]) => void;
  /** @default calls onFilterAll([]) */
  readonly onClearFilters?: () => void;
  readonly onDelete: (label_ids: readonly KitchenwareLabelId[]) => void;
  readonly onMerge: (label_ids: readonly KitchenwareLabelId[], new_name: string) => void;
  readonly onRename: (id: KitchenwareLabelId, name: string) => void;
}

export function LabelTable({
  labels,
  ingredients,
  onFilterAll,
  onFilterAny,
  onClearFilters = () => onFilterAll([]),
  onDelete,
  onMerge,
  onRename,
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

  function handleMergeSubmit(e: FormEvent): void {
    e.preventDefault();
    const name = mergeName.trim();
    if (name === "" || selectedArray.length < 2) return;
    onMerge(selectedArray, name);
    setMergeName("");
    setShowMergeInput(false);
    clearSelection();
  }

  function beginEdit(label: ReadonlyDeep<KitchenwareLabel>): void {
    setEditingId(label.id);
    setEditingName(label.name);
  }

  function commitEdit(): void {
    const name = editingName.trim();
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
    <section className="lt-section" aria-label="Labels">
      <button
        type="button"
        className="lt-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="lt-panel"
      >
        <span className="lt-toggle-icon" aria-hidden>
          {expanded ? "▼" : "▶"}
        </span>
        Labels
        {labels.length > 0 && (
          <span className="lt-count" aria-label={`${labels.length} labels`}>
            {labels.length}
          </span>
        )}
      </button>

      {expanded && (
        <div id="lt-panel" className="lt-panel">
          {/* Bulk action bar */}
          {someSelected && (
            <div className="lt-bulk-bar" role="region" aria-label="Label bulk actions">
              <button type="button" className="lt-bulk-clear" onClick={clearSelection}>
                Clear
              </button>
              <span className="lt-bulk-count">{selectedIds.size} selected</span>
              <span className="lt-filter-label">Filter:</span>
              <div className="lt-filter-group" role="group" aria-label="Filter mode">
                <label
                  htmlFor="lt-filter-off"
                  className={`lt-filter-btn${filterMode === null ? " lt-filter-btn--active" : ""}`}
                >
                  <RadioButton
                    inputId="lt-filter-off"
                    name="lt_filter_mode"
                    value="off"
                    checked={filterMode === null}
                    onChange={handleFilterOff}
                  />
                  Off
                </label>
                <label
                  htmlFor="lt-filter-all"
                  className={`lt-filter-btn${filterMode === "all" ? " lt-filter-btn--active" : ""}`}
                >
                  <RadioButton
                    inputId="lt-filter-all"
                    name="lt_filter_mode"
                    value="all"
                    checked={filterMode === "all"}
                    onChange={handleFilterAll}
                  />
                  All
                </label>
                <label
                  htmlFor="lt-filter-any"
                  className={`lt-filter-btn${filterMode === "any" ? " lt-filter-btn--active" : ""}`}
                >
                  <RadioButton
                    inputId="lt-filter-any"
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
                className="lt-bulk-btn"
                onClick={handleDeleteClick}
                aria-label="Delete selected labels"
              >
                Delete
              </button>
              {selectedArray.length >= 2 && (
                <>
                  {showMergeInput ? (
                    <form className="lt-merge-form" onSubmit={handleMergeSubmit}>
                      <input
                        type="text"
                        className="lt-merge-input"
                        value={mergeName}
                        onChange={(e) => setMergeName(e.target.value)}
                        placeholder="Merged label name…"
                        aria-label="Merged label name"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setShowMergeInput(false);
                            setMergeName("");
                          }
                        }}
                      />
                      <button
                        type="submit"
                        className="lt-bulk-btn"
                        disabled={mergeName.trim() === ""}
                        aria-label="Confirm merge"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="lt-bulk-btn"
                        onClick={() => {
                          setShowMergeInput(false);
                          setMergeName("");
                        }}
                        aria-label="Cancel merge"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="lt-bulk-btn"
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
            <div
              className="lt-delete-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Confirm delete labels"
              aria-describedby="lt-delete-desc"
              tabIndex={-1}
              onClick={handleDeleteCancel}
              onKeyDown={(e) => {
                if (e.key === "Escape") handleDeleteCancel();
              }}
            >
              <div
                className="lt-delete-dialog"
                data-testid="lt-delete-dialog-card"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="lt-delete-title">
                  Delete {selectedIds.size} label{selectedIds.size !== 1 ? "s" : ""}?
                </p>
                <div id="lt-delete-desc">
                  {affectedIngredients.length > 0 ? (
                    <>
                      <p className="lt-delete-subtitle">
                        The following ingredient{affectedIngredients.length !== 1 ? "s" : ""} will
                        be affected:
                      </p>
                      <ul className="lt-delete-list">
                        {affectedIngredients.map((ing) => (
                          <li key={ing.id}>{ing.name}</li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="lt-delete-subtitle">No ingredients use these labels.</p>
                  )}
                </div>
                <div className="lt-delete-actions">
                  <button
                    type="button"
                    className="lt-delete-btn lt-delete-btn--cancel"
                    onClick={handleDeleteCancel}
                    autoFocus
                    aria-label="Cancel delete"
                  >
                    ↩ Cancel
                  </button>
                  <button
                    type="button"
                    className="lt-delete-btn lt-delete-btn--accept"
                    onClick={handleDeleteConfirm}
                    aria-label="Confirm delete"
                  >
                    ✔︎ Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {labels.length === 0 ? (
            <p className="lt-empty">No labels yet.</p>
          ) : (
            <table className="lt-table" aria-label="Label list">
              <thead>
                <tr>
                  <th className="lt-th lt-th--select">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected && !allSelected;
                      }}
                      onChange={toggleAll}
                      aria-label="Select all labels"
                    />
                  </th>
                  <th className="lt-th">Name</th>
                  <th className="lt-th">Used for</th>
                </tr>
              </thead>
              <tbody>
                {labels.map((label) => (
                  <tr
                    key={label.id}
                    className={`lt-row${selectedIds.has(label.id) ? " lt-row--selected" : ""}`}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.tagName === "INPUT" || target.closest("button") !== null) return;
                      toggle(label.id);
                    }}
                  >
                    <td className="lt-td lt-td--select">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(label.id)}
                        onChange={() => toggle(label.id)}
                        aria-label={`Select label ${label.name}`}
                      />
                    </td>
                    <td className="lt-td">
                      {editingId === label.id ? (
                        <span className="lt-editing">
                          <input
                            type="text"
                            className="lt-edit-input"
                            value={editingName}
                            autoFocus
                            aria-label={`Edit label name ${label.name}`}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit();
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                          <button
                            type="button"
                            className="lt-edit-btn"
                            onClick={cancelEdit}
                            aria-label="Cancel rename"
                          >
                            ↩
                          </button>
                          <button
                            type="button"
                            className="lt-edit-btn"
                            onClick={commitEdit}
                            aria-label="Confirm rename"
                          >
                            ✔︎
                          </button>
                        </span>
                      ) : (
                        <span
                          className="lt-name"
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
                    <td className="lt-td lt-td--kinds">{[...label.kinds].join(", ")}</td>
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
