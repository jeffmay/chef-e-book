import type { KitchenwareLabel, KitchenwareLabelId } from "@recipe-book/shared";
import { RadioButton } from "primereact/radiobutton";
import { useState, type FormEvent } from "react";
import { ReadonlyDeep } from "type-fest";
import "./label_table.css";

export interface LabelTableProps {
  readonly labels: ReadonlyDeep<KitchenwareLabel[]>;
  readonly onFilterAll: (label_ids: readonly KitchenwareLabelId[]) => void;
  readonly onFilterAny: (label_ids: readonly KitchenwareLabelId[]) => void;
  readonly onDelete: (label_ids: readonly KitchenwareLabelId[]) => void;
  readonly onMerge: (label_ids: readonly KitchenwareLabelId[], new_name: string) => void;
  readonly onRename: (id: KitchenwareLabelId, name: string) => void;
}

export function LabelTable({
  labels,
  onFilterAll,
  onFilterAny,
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

  const selectedArray = [...selectedIds];
  const allSelected =
    labels.length > 0 && labels.every((l) => selectedIds.has(l.id));
  const someSelected = labels.some((l) => selectedIds.has(l.id));

  function toggle(id: KitchenwareLabelId): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(): void {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(labels.map((l) => l.id)));
    }
  }

  function handleFilterAll(): void {
    setFilterMode("all");
    onFilterAll(selectedArray);
  }

  function handleFilterAny(): void {
    setFilterMode("any");
    onFilterAny(selectedArray);
  }

  function handleDelete(): void {
    onDelete(selectedArray);
    setSelectedIds(new Set());
  }

  function handleMergeSubmit(e: FormEvent): void {
    e.preventDefault();
    const name = mergeName.trim();
    if (name === "" || selectedArray.length < 2) return;
    onMerge(selectedArray, name);
    setMergeName("");
    setShowMergeInput(false);
    setSelectedIds(new Set());
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
    <section className="lt_section" aria-label="Labels">
      <button
        type="button"
        className="lt_toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="lt-panel"
      >
        <span className="lt_toggle_icon" aria-hidden>
          {expanded ? "▼" : "▶"}
        </span>
        Labels
        {labels.length > 0 && (
          <span className="lt_count" aria-label={`${labels.length} labels`}>
            {labels.length}
          </span>
        )}
      </button>

      {expanded && (
        <div id="lt-panel" className="lt_panel">
          {/* Bulk action bar */}
          {someSelected && (
            <div className="lt_bulk_bar" role="region" aria-label="Label bulk actions">
              <span className="lt_bulk_count">{selectedIds.size} selected</span>
              <span className="lt_filter_label">Filter:</span>
              <div className="lt_filter_group" role="group" aria-label="Filter mode">
                <label
                  htmlFor="lt-filter-all"
                  className={`lt_filter_btn${filterMode === "all" ? " lt_filter_btn--active" : ""}`}
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
                  className={`lt_filter_btn${filterMode === "any" ? " lt_filter_btn--active" : ""}`}
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
                type="button"
                className="lt_bulk_btn lt_bulk_btn--danger"
                onClick={handleDelete}
                aria-label="Delete selected labels"
              >
                Delete
              </button>
              {selectedArray.length >= 2 && (
                <>
                  {showMergeInput ? (
                    <form className="lt_merge_form" onSubmit={handleMergeSubmit}>
                      <input
                        type="text"
                        className="lt_merge_input"
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
                        className="lt_bulk_btn"
                        disabled={mergeName.trim() === ""}
                        aria-label="Confirm merge"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="lt_bulk_btn"
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
                      className="lt_bulk_btn"
                      onClick={() => setShowMergeInput(true)}
                      aria-label="Merge selected labels"
                    >
                      Merge
                    </button>
                  )}
                </>
              )}
              <button
                type="button"
                className="lt_bulk_clear"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </button>
            </div>
          )}

          {labels.length === 0 ? (
            <p className="lt_empty">No labels yet.</p>
          ) : (
            <table className="lt_table" aria-label="Label list">
              <thead>
                <tr>
                  <th className="lt_th lt_th--select">
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
                  <th className="lt_th">Name</th>
                  <th className="lt_th">Used for</th>
                </tr>
              </thead>
              <tbody>
                {labels.map((label) => (
                  <tr
                    key={label.id}
                    className={selectedIds.has(label.id) ? "lt-row--selected" : ""}
                  >
                    <td className="lt_td lt_td--select">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(label.id)}
                        onChange={() => toggle(label.id)}
                        aria-label={`Select label ${label.name}`}
                      />
                    </td>
                    <td className="lt_td">
                      {editingId === label.id ? (
                        <span className="lt_editing">
                          <input
                            type="text"
                            className="lt_edit_input"
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
                            className="lt_edit_btn"
                            onClick={commitEdit}
                            aria-label="Confirm rename"
                          >
                            ✔︎
                          </button>
                          <button
                            type="button"
                            className="lt_edit_btn"
                            onClick={cancelEdit}
                            aria-label="Cancel rename"
                          >
                            ✗
                          </button>
                        </span>
                      ) : (
                        <span
                          className="lt_name"
                          role="button"
                          tabIndex={0}
                          aria-label={`Rename label ${label.name}`}
                          onClick={() => beginEdit(label)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") beginEdit(label);
                          }}
                        >
                          {label.name}
                        </span>
                      )}
                    </td>
                    <td className="lt_td lt_td--kinds">
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
