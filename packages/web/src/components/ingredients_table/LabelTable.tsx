import { useState, type FormEvent } from "react";
import type { ItemLabel } from "@recipe-book/shared";
import "./LabelTable.css";

export interface LabelTableProps {
  readonly labels: readonly ItemLabel[];
  readonly on_filter_all: (label_ids: readonly ItemLabel.Id[]) => void;
  readonly on_filter_any: (label_ids: readonly ItemLabel.Id[]) => void;
  readonly on_delete: (label_ids: readonly ItemLabel.Id[]) => void;
  readonly on_merge: (label_ids: readonly ItemLabel.Id[], new_name: string) => void;
  readonly on_rename: (id: ItemLabel.Id, name: string) => void;
}

export function LabelTable({
  labels,
  on_filter_all,
  on_filter_any,
  on_delete,
  on_merge,
  on_rename,
}: LabelTableProps) {
  const [expanded, set_expanded] = useState(false);
  const [selected_ids, set_selected_ids] = useState<Set<ItemLabel.Id>>(new Set());
  const [merge_name, set_merge_name] = useState("");
  const [show_merge_input, set_show_merge_input] = useState(false);
  const [editing_id, set_editing_id] = useState<ItemLabel.Id | null>(null);
  const [editing_name, set_editing_name] = useState("");

  const selected_array = [...selected_ids];
  const all_selected =
    labels.length > 0 && labels.every((l) => selected_ids.has(l.id));
  const some_selected = labels.some((l) => selected_ids.has(l.id));

  function toggle(id: ItemLabel.Id): void {
    set_selected_ids((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggle_all(): void {
    if (all_selected) {
      set_selected_ids(new Set());
    } else {
      set_selected_ids(new Set(labels.map((l) => l.id)));
    }
  }

  function handle_filter_all(): void {
    on_filter_all(selected_array);
  }

  function handle_filter_any(): void {
    on_filter_any(selected_array);
  }

  function handle_delete(): void {
    on_delete(selected_array);
    set_selected_ids(new Set());
  }

  function handle_merge_submit(e: FormEvent): void {
    e.preventDefault();
    const name = merge_name.trim();
    if (name === "" || selected_array.length < 2) return;
    on_merge(selected_array, name);
    set_merge_name("");
    set_show_merge_input(false);
    set_selected_ids(new Set());
  }

  function begin_edit(label: ItemLabel): void {
    set_editing_id(label.id);
    set_editing_name(label.name);
  }

  function commit_edit(): void {
    const name = editing_name.trim();
    if (name !== "" && editing_id !== null) {
      on_rename(editing_id, name);
    }
    set_editing_id(null);
    set_editing_name("");
  }

  function cancel_edit(): void {
    set_editing_id(null);
    set_editing_name("");
  }

  return (
    <section className="lt-section" aria-label="Labels">
      <button
        type="button"
        className="lt-toggle"
        onClick={() => set_expanded((v) => !v)}
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
          {some_selected && (
            <div className="lt-bulk-bar" role="region" aria-label="Label bulk actions">
              <span className="lt-bulk-count">{selected_ids.size} selected</span>
              <button
                type="button"
                className="lt-bulk-btn"
                onClick={handle_filter_all}
                aria-label="Filter ingredients with all selected labels"
              >
                Filter: All
              </button>
              <button
                type="button"
                className="lt-bulk-btn"
                onClick={handle_filter_any}
                aria-label="Filter ingredients with any selected labels"
              >
                Filter: Any
              </button>
              <button
                type="button"
                className="lt-bulk-btn lt-bulk-btn--danger"
                onClick={handle_delete}
                aria-label="Delete selected labels"
              >
                Delete
              </button>
              {selected_array.length >= 2 && (
                <>
                  {show_merge_input ? (
                    <form className="lt-merge-form" onSubmit={handle_merge_submit}>
                      <input
                        type="text"
                        className="lt-merge-input"
                        value={merge_name}
                        onChange={(e) => set_merge_name(e.target.value)}
                        placeholder="Merged label name…"
                        aria-label="Merged label name"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            set_show_merge_input(false);
                            set_merge_name("");
                          }
                        }}
                      />
                      <button
                        type="submit"
                        className="lt-bulk-btn"
                        disabled={merge_name.trim() === ""}
                        aria-label="Confirm merge"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="lt-bulk-btn"
                        onClick={() => {
                          set_show_merge_input(false);
                          set_merge_name("");
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
                      onClick={() => set_show_merge_input(true)}
                      aria-label="Merge selected labels"
                    >
                      Merge
                    </button>
                  )}
                </>
              )}
              <button
                type="button"
                className="lt-bulk-clear"
                onClick={() => set_selected_ids(new Set())}
              >
                Clear
              </button>
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
                      checked={all_selected}
                      ref={(el) => {
                        if (el) el.indeterminate = some_selected && !all_selected;
                      }}
                      onChange={toggle_all}
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
                    className={selected_ids.has(label.id) ? "lt-row--selected" : ""}
                  >
                    <td className="lt-td lt-td--select">
                      <input
                        type="checkbox"
                        checked={selected_ids.has(label.id)}
                        onChange={() => toggle(label.id)}
                        aria-label={`Select label ${label.name}`}
                      />
                    </td>
                    <td className="lt-td">
                      {editing_id === label.id ? (
                        <span className="lt-editing">
                          <input
                            type="text"
                            className="lt-edit-input"
                            value={editing_name}
                            autoFocus
                            aria-label={`Edit label name ${label.name}`}
                            onChange={(e) => set_editing_name(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commit_edit();
                              if (e.key === "Escape") cancel_edit();
                            }}
                          />
                          <button
                            type="button"
                            className="lt-edit-btn"
                            onClick={commit_edit}
                            aria-label="Confirm rename"
                          >
                            ✔︎
                          </button>
                          <button
                            type="button"
                            className="lt-edit-btn"
                            onClick={cancel_edit}
                            aria-label="Cancel rename"
                          >
                            ✗
                          </button>
                        </span>
                      ) : (
                        <span
                          className="lt-name"
                          role="button"
                          tabIndex={0}
                          aria-label={`Rename label ${label.name}`}
                          onClick={() => begin_edit(label)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") begin_edit(label);
                          }}
                        >
                          {label.name}
                        </span>
                      )}
                    </td>
                    <td className="lt-td lt-td--kinds">
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
