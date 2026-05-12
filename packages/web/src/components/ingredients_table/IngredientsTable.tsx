import { useState, useMemo, useEffect, type KeyboardEvent } from "react";
import { TreeTable, type TreeTableExpandedKeysType, type TreeTableFilterMeta } from "primereact/treetable";
import { Column } from "primereact/column";
import { FilterMatchMode } from "primereact/api";
import type { Ingredient, IngredientId, KitchenwareLabel, KitchenwareLabelId, MeasurementType } from "@recipe-book/shared";
import { MultiSelectFilter } from "./MultiSelectFilter.js";
import { LabelEditor } from "./LabelEditor.js";
import { buildIngredientTree, type IngredientNodeData, type IngredientTreeNode } from "./build_ingredient_tree.js";
import "./IngredientsTable.css";

// ---------------------------------------------------------------------------
// External label filter (driven by LabelTable)
// ---------------------------------------------------------------------------

export interface ExternalLabelFilter {
  readonly label_ids: readonly KitchenwareLabelId[];
  readonly mode: "all" | "any";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MEASUREMENT_TYPES: readonly MeasurementType[] = ["count", "volume", "weight"];

function validateType(v: string): MeasurementType | undefined {
  if (v === "volume" || v === "weight" || v === "count") return v;
  return undefined;
}

function parseLabels(raw: string): string[] {
  return raw
    .split(",")
    .map((l) => l.trim())
    .filter((l) => l !== "");
}

function pkey(ingredient_id: IngredientId, col_id: string): string {
  return `${ingredient_id}|${col_id}`;
}

function collectAllKeys(nodes: IngredientTreeNode[]): TreeTableExpandedKeysType {
  const keys: TreeTableExpandedKeysType = {};
  function visit(ns: IngredientTreeNode[]) {
    for (const n of ns) {
      if (n.children?.length) {
        keys[n.key] = true;
        visit(n.children);
      }
    }
  }
  visit(nodes);
  return keys;
}

function collectAllIds(nodes: IngredientTreeNode[]): IngredientId[] {
  const ids: IngredientId[] = [];
  function visit(ns: IngredientTreeNode[]) {
    for (const n of ns) {
      ids.push(n.data.id);
      if (n.children?.length) visit(n.children);
    }
  }
  visit(nodes);
  return ids;
}

// ---------------------------------------------------------------------------
// Editable cell sub-components
// ---------------------------------------------------------------------------

interface EditCellProps {
  data: IngredientNodeData;
  col_id: string;
  pending_edits: ReadonlyMap<string, string>;
  all_ingredients: readonly Ingredient[];
  all_label_names: readonly string[];
  onBeginEdit: (id: IngredientId, col_id: string, initial: string) => void;
  onUpdateEdit: (id: IngredientId, col_id: string, value: string) => void;
  onCommitEdit: (id: IngredientId, col_id: string) => void;
  onCancelEdit: (id: IngredientId, col_id: string) => void;
}

function NameCell({ data, col_id, pending_edits, onBeginEdit, onUpdateEdit, onCommitEdit, onCancelEdit }: EditCellProps) {
  const key = pkey(data.id, col_id);
  const pending = pending_edits.get(key);
  if (pending !== undefined) {
    return (
      <span className="it-editing">
        <input
          type="text"
          value={pending}
          className="it-edit-input"
          autoFocus
          aria-label={`Edit name for ${data.name}`}
          onChange={(e) => onUpdateEdit(data.id, col_id, e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") onCommitEdit(data.id, col_id);
            if (e.key === "Escape") onCancelEdit(data.id, col_id);
          }}
        />
        <button type="button" className="it-confirm-btn" onClick={() => onCommitEdit(data.id, col_id)} aria-label="Confirm edit">✔︎</button>
        <button type="button" className="it-cancel-btn" onClick={() => onCancelEdit(data.id, col_id)} aria-label="Cancel edit">✗</button>
      </span>
    );
  }
  return (
    <span
      className="it-editable"
      role="button"
      tabIndex={0}
      aria-label={`Edit name for ${data.name}`}
      onClick={() => onBeginEdit(data.id, col_id, data.name)}
      onKeyDown={(e: KeyboardEvent<HTMLSpanElement>) => {
        if (e.key === "Enter" || e.key === " ") onBeginEdit(data.id, col_id, data.name);
      }}
    >
      {data.name}
    </span>
  );
}

function TypeCell({ data, col_id, pending_edits, onBeginEdit, onUpdateEdit, onCommitEdit, onCancelEdit }: EditCellProps) {
  const key = pkey(data.id, col_id);
  const pending = pending_edits.get(key);
  if (pending !== undefined) {
    return (
      <span className="it-editing">
        <select
          value={pending}
          autoFocus
          aria-label={`Edit type for ${data.name}`}
          onChange={(e) => onUpdateEdit(data.id, col_id, e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLSelectElement>) => {
            if (e.key === "Escape") onCancelEdit(data.id, col_id);
          }}
        >
          {MEASUREMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button type="button" className="it-confirm-btn" onClick={() => onCommitEdit(data.id, col_id)} aria-label="Confirm edit">✔︎</button>
        <button type="button" className="it-cancel-btn" onClick={() => onCancelEdit(data.id, col_id)} aria-label="Cancel edit">✗</button>
      </span>
    );
  }
  return (
    <span
      className="it-editable"
      role="button"
      tabIndex={0}
      aria-label={`Edit type for ${data.name}`}
      onClick={() => onBeginEdit(data.id, col_id, data.default_measurement_type)}
      onKeyDown={(e: KeyboardEvent<HTMLSpanElement>) => {
        if (e.key === "Enter" || e.key === " ") onBeginEdit(data.id, col_id, data.default_measurement_type);
      }}
    >
      {data.default_measurement_type}
    </span>
  );
}

function LabelsCell({ data, col_id, pending_edits, all_label_names, onBeginEdit, onUpdateEdit, onCommitEdit, onCancelEdit }: EditCellProps) {
  const key = pkey(data.id, col_id);
  const pending = pending_edits.get(key);
  if (pending !== undefined) {
    return (
      <LabelEditor
        selected_label_names={parseLabels(pending)}
        all_label_names={all_label_names}
        aria_label={`Edit labels for ${data.name}`}
        onChange={(names) => onUpdateEdit(data.id, col_id, names.join(", "))}
        onCommit={() => onCommitEdit(data.id, col_id)}
        onCancel={() => onCancelEdit(data.id, col_id)}
      />
    );
  }
  const display = data.labels.join(", ");
  return (
    <span
      className="it-editable"
      role="button"
      tabIndex={0}
      aria-label={`Edit labels for ${data.name}`}
      onClick={() => onBeginEdit(data.id, col_id, display)}
      onKeyDown={(e: KeyboardEvent<HTMLSpanElement>) => {
        if (e.key === "Enter" || e.key === " ") onBeginEdit(data.id, col_id, display);
      }}
    >
      {display || <span className="it-muted">—</span>}
    </span>
  );
}

function ParentCell({ data, col_id, pending_edits, all_ingredients, onBeginEdit, onUpdateEdit, onCommitEdit, onCancelEdit }: EditCellProps) {
  const key = pkey(data.id, col_id);
  const pending = pending_edits.get(key);
  const display = data.parent_name || "—";
  if (pending !== undefined) {
    return (
      <span className="it-editing">
        <select
          value={pending}
          autoFocus
          aria-label={`Edit parent for ${data.name}`}
          onChange={(e) => onUpdateEdit(data.id, col_id, e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLSelectElement>) => {
            if (e.key === "Escape") onCancelEdit(data.id, col_id);
          }}
        >
          <option value="">— None —</option>
          {all_ingredients
            .filter((i) => i.id !== data.id)
            .map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <button type="button" className="it-confirm-btn" onClick={() => onCommitEdit(data.id, col_id)} aria-label="Confirm edit">✔︎</button>
        <button type="button" className="it-cancel-btn" onClick={() => onCancelEdit(data.id, col_id)} aria-label="Cancel edit">✗</button>
      </span>
    );
  }
  return (
    <span
      className="it-editable"
      role="button"
      tabIndex={0}
      aria-label={`Edit parent for ${data.name}`}
      onClick={() => onBeginEdit(data.id, col_id, data.parent_id ?? "")}
      onKeyDown={(e: KeyboardEvent<HTMLSpanElement>) => {
        if (e.key === "Enter" || e.key === " ") onBeginEdit(data.id, col_id, data.parent_id ?? "");
      }}
    >
      {display}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component props
// ---------------------------------------------------------------------------

export interface IngredientsTableProps {
  readonly ingredients: readonly Ingredient[];
  readonly labels: readonly KitchenwareLabel[];
  readonly external_label_filter?: ExternalLabelFilter;
  readonly onRename: (id: IngredientId, name: string) => void;
  readonly onSetType: (id: IngredientId, type: MeasurementType) => void;
  readonly onSetLabels: (id: IngredientId, label_names: readonly string[]) => void;
  readonly onSetParent: (id: IngredientId, parent_id: IngredientId | undefined) => void;
  readonly onAddLabels: (ids: readonly IngredientId[], label_names: readonly string[]) => void;
  readonly onRemoveLabels: (ids: readonly IngredientId[], label_names: readonly string[]) => void;
  readonly onBulkSetType: (ids: readonly IngredientId[], type: MeasurementType) => void;
  readonly onBulkSetParent: (ids: readonly IngredientId[], parent_id: IngredientId | undefined) => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function IngredientsTable({
  ingredients,
  labels,
  external_label_filter,
  onRename,
  onSetType,
  onSetLabels,
  onSetParent,
  onAddLabels,
  onRemoveLabels,
  onBulkSetType,
  onBulkSetParent,
}: IngredientsTableProps) {
  // ---- filter state -------------------------------------------------------
  // Name filter goes through PrimeReact's filter system (filterMode="lenient")
  const [filters, setFilters] = useState<TreeTableFilterMeta>({
    name: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });
  // Type and labels filters are pre-applied to the ingredient list
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [labelsColumnFilter, setLabelsColumnFilter] = useState<string[]>([]);

  // ---- sort state ---------------------------------------------------------
  const [sortField, setSortField] = useState("");
  const [sortOrder, setSortOrder] = useState<1 | -1 | 0>(0);

  // ---- expand state -------------------------------------------------------
  const [expandedKeys, setExpandedKeys] = useState<TreeTableExpandedKeysType>({});

  // ---- edit state ---------------------------------------------------------
  const [pending_edits, set_pending_edits] = useState<ReadonlyMap<string, string>>(new Map());

  // ---- selection state ----------------------------------------------------
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<IngredientId>>(new Set());

  // ---- bulk action state --------------------------------------------------
  const [bulk_add_labels, set_bulk_add_labels] = useState<readonly string[]>([]);
  const [bulk_remove_labels, set_bulk_remove_labels] = useState<readonly string[]>([]);
  const [bulk_type, set_bulk_type] = useState("");
  const [bulk_parent_id, set_bulk_parent_id] = useState("");

  // ---- derived data -------------------------------------------------------
  const all_label_names = useMemo(() => labels.map((l) => l.name).sort(), [labels]);

  const filteredIngredients = useMemo(() => {
    let result = ingredients;
    if (external_label_filter && external_label_filter.label_ids.length > 0) {
      const { label_ids, mode } = external_label_filter;
      result = result.filter((i) =>
        mode === "all"
          ? label_ids.every((id) => i.labels.has(id))
          : label_ids.some((id) => i.labels.has(id)),
      );
    }
    if (typeFilter.length > 0) {
      result = result.filter((i) => typeFilter.includes(i.default_measurement_type));
    }
    if (labelsColumnFilter.length > 0) {
      const labelIdByName = new Map(labels.map((l) => [l.name, l.id]));
      result = result.filter((i) =>
        labelsColumnFilter.some((name) => {
          const id = labelIdByName.get(name);
          return id !== undefined && i.labels.has(id as KitchenwareLabelId);
        }),
      );
    }
    return result;
  }, [ingredients, external_label_filter, typeFilter, labelsColumnFilter, labels]);

  const treeNodes = useMemo(
    () => buildIngredientTree(filteredIngredients, labels),
    [filteredIngredients, labels],
  );

  // Auto-expand when name filter is active
  useEffect(() => {
    const nameFilter = filters.name?.value;
    if (typeof nameFilter === "string" && nameFilter !== "") {
      setExpandedKeys(collectAllKeys(treeNodes));
    } else {
      setExpandedKeys({});
    }
  }, [filters.name?.value, treeNodes]);

  // ---- sort helper --------------------------------------------------------
  function handleSort(field: string) {
    if (sortField === field) {
      if (sortOrder === 1) setSortOrder(-1);
      else { setSortField(""); setSortOrder(0); }
    } else {
      setSortField(field);
      setSortOrder(1);
    }
  }

  // ---- edit helpers -------------------------------------------------------
  function onBeginEdit(id: IngredientId, col_id: string, initial: string) {
    set_pending_edits((prev) => new Map(prev).set(pkey(id, col_id), initial));
  }

  function onUpdateEdit(id: IngredientId, col_id: string, value: string) {
    const key = pkey(id, col_id);
    set_pending_edits((prev) => {
      if (!prev.has(key)) return prev;
      return new Map(prev).set(key, value);
    });
  }

  function onCommitEdit(id: IngredientId, col_id: string) {
    const key = pkey(id, col_id);
    const value = pending_edits.get(key);
    if (value === undefined) return;
    if (col_id === "name") {
      const trimmed = value.trim();
      if (trimmed !== "") onRename(id, trimmed);
    } else if (col_id === "default_measurement_type") {
      const type = validateType(value);
      if (type !== undefined) onSetType(id, type);
    } else if (col_id === "labels") {
      onSetLabels(id, parseLabels(value));
    } else if (col_id === "parent_name") {
      onSetParent(id, value !== "" ? (value as IngredientId) : undefined);
    }
    set_pending_edits((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }

  function onCancelEdit(id: IngredientId, col_id: string) {
    const key = pkey(id, col_id);
    set_pending_edits((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }

  // ---- selection helpers --------------------------------------------------
  function toggleSelect(id: IngredientId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const allIds = collectAllIds(treeNodes);
    setSelectedIds((prev) => {
      const allSelected = allIds.length > 0 && allIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        for (const id of allIds) next.delete(id);
      } else {
        for (const id of allIds) next.add(id);
      }
      return next;
    });
  }

  // ---- bulk helpers -------------------------------------------------------
  const selectedArray = [...selectedIds];

  function applyAddLabels() {
    if (bulk_add_labels.length > 0) {
      onAddLabels(selectedArray, bulk_add_labels);
      set_bulk_add_labels([]);
    }
  }

  function applyRemoveLabels() {
    if (bulk_remove_labels.length > 0) {
      onRemoveLabels(selectedArray, bulk_remove_labels);
      set_bulk_remove_labels([]);
    }
  }

  function applyBulkType() {
    const type = validateType(bulk_type);
    if (type !== undefined) {
      onBulkSetType(selectedArray, type);
      set_bulk_type("");
    }
  }

  function applyBulkParent() {
    if (bulk_parent_id === "__none__") {
      onBulkSetParent(selectedArray, undefined);
    } else if (bulk_parent_id !== "") {
      onBulkSetParent(selectedArray, bulk_parent_id as IngredientId);
    }
    set_bulk_parent_id("");
  }

  // ---- sort button header -------------------------------------------------
  function SortHeader({ label, field }: { label: string; field: string }) {
    const sorted = sortField === field ? sortOrder : 0;
    return (
      <div className="it-col-header">
        <button
          type="button"
          className="it-sort-btn"
          onClick={() => handleSort(field)}
          aria-label={`Sort by ${field}`}
        >
          {label}
          <span className="it-sort-icon" aria-hidden>
            {sorted === 1 ? " ↑" : sorted === -1 ? " ↓" : " ↕"}
          </span>
        </button>
      </div>
    );
  }

  // ---- shared edit cell props factory ------------------------------------
  function editProps(col_id: string): Omit<EditCellProps, "data"> {
    return {
      col_id,
      pending_edits,
      all_ingredients: ingredients,
      all_label_names,
      onBeginEdit,
      onUpdateEdit,
      onCommitEdit,
      onCancelEdit,
    };
  }

  // ---- compute select-all state -------------------------------------------
  const allVisibleIds = collectAllIds(treeNodes);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id));
  const someSelected = allVisibleIds.some((id) => selectedIds.has(id));

  // ---- render -------------------------------------------------------------
  return (
    <div className="it-wrapper" role="region" aria-label="Ingredient list">
      {selectedIds.size > 0 && (
        <div className="it-bulk-bar" role="region" aria-label="Bulk actions">
          <span className="it-bulk-count">{selectedIds.size} selected</span>
          <button
            type="button"
            className="it-bulk-clear"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </button>

          <span className="it-bulk-action">
            <LabelEditor
              selected_label_names={bulk_add_labels}
              all_label_names={all_label_names}
              aria_label="Labels to add"
              placeholder="Labels to add…"
              commit_aria_label="Apply add labels"
              commit_disabled={bulk_add_labels.length === 0}
              onChange={(names) => set_bulk_add_labels(names)}
              onCommit={applyAddLabels}
              onCancel={() => set_bulk_add_labels([])}
            />
          </span>

          <span className="it-bulk-action">
            <LabelEditor
              selected_label_names={bulk_remove_labels}
              all_label_names={all_label_names}
              aria_label="Labels to remove"
              placeholder="Labels to remove…"
              commit_aria_label="Apply remove labels"
              commit_disabled={bulk_remove_labels.length === 0}
              onChange={(names) => set_bulk_remove_labels(names)}
              onCommit={applyRemoveLabels}
              onCancel={() => set_bulk_remove_labels([])}
            />
          </span>

          <span className="it-bulk-action">
            <select
              className="it-bulk-select"
              value={bulk_type}
              onChange={(e) => set_bulk_type(e.target.value)}
              aria-label="Bulk measurement type"
            >
              <option value="">— Type —</option>
              {MEASUREMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button
              type="button"
              className="it-bulk-apply"
              disabled={bulk_type === ""}
              onClick={applyBulkType}
              aria-label="Apply type change"
            >
              Change type
            </button>
          </span>

          <span className="it-bulk-action">
            <select
              className="it-bulk-select"
              value={bulk_parent_id}
              onChange={(e) => set_bulk_parent_id(e.target.value)}
              aria-label="Bulk parent"
            >
              <option value="">— Parent —</option>
              <option value="__none__">Clear parent</option>
              {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <button
              type="button"
              className="it-bulk-apply"
              disabled={bulk_parent_id === ""}
              onClick={applyBulkParent}
              aria-label="Apply parent change"
            >
              Change parent
            </button>
          </span>
        </div>
      )}

      <TreeTable
        value={treeNodes}
        expandedKeys={expandedKeys}
        onToggle={(e) => setExpandedKeys(e.value)}
        filters={filters}
        onFilter={setFilters}
        filterMode="lenient"
        sortField={sortField || undefined}
        sortOrder={sortOrder || undefined}
        sortMode="single"
        emptyMessage={
          <span className="it-empty">No ingredients match the current filter.</span>
        }
        tableStyle={{ width: "100%" }}
        className="it-table"
      >
        {/* Selection column */}
        <Column
          style={{ width: "2em", minWidth: "2em" }}
          header={
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected && !allSelected;
              }}
              onChange={toggleSelectAll}
              aria-label="Select all ingredients"
            />
          }
          body={(node: IngredientTreeNode) => (
            <input
              type="checkbox"
              checked={selectedIds.has(node.data.id)}
              onChange={() => toggleSelect(node.data.id)}
              aria-label={`Select ${node.data.name}`}
            />
          )}
        />

        {/* Expander column */}
        <Column
          expander
          style={{ width: "2.5em", minWidth: "2.5em" }}
          body={(node: IngredientTreeNode) => {
            const hasChildren = (node.children ?? []).length > 0;
            if (!hasChildren) return <span className="it-expand-spacer" aria-hidden />;
            const isExpanded = expandedKeys[node.key] === true;
            function toggleExpand() {
              setExpandedKeys((prev) => {
                const next = { ...prev };
                if (next[node.key]) {
                  delete next[node.key];
                } else {
                  next[node.key] = true;
                }
                return next;
              });
            }
            return (
              <button
                type="button"
                className="it-expand-btn"
                onClick={toggleExpand}
                aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.data.name}`}
              >
                {isExpanded ? "▼" : "▶"}
              </button>
            );
          }}
        />

        {/* Name column */}
        <Column
          field="name"
          header={
            <div className="it-col-header">
              <SortHeader label="Name" field="name" />
              <div className="it-filter-row">
                <input
                  type="text"
                  className="it-text-filter"
                  value={typeof filters.name?.value === "string" ? filters.name.value : ""}
                  onChange={(e) => {
                    const val = e.target.value || null;
                    setFilters({ name: { value: val, matchMode: FilterMatchMode.CONTAINS } });
                  }}
                  placeholder="Filter…"
                  aria-label="Filter by name"
                />
              </div>
            </div>
          }
          sortable
          body={(node: IngredientTreeNode) => (
            <NameCell {...editProps("name")} data={node.data} />
          )}
        />

        {/* Type column */}
        <Column
          field="default_measurement_type"
          header={
            <div className="it-col-header">
              <SortHeader label="Type" field="default_measurement_type" />
              <div className="it-filter-row">
                <MultiSelectFilter
                  allOptions={MEASUREMENT_TYPES}
                  value={typeFilter}
                  onChange={setTypeFilter}
                  ariaLabel="Filter by type"
                />
              </div>
            </div>
          }
          sortable
          body={(node: IngredientTreeNode) => (
            <TypeCell {...editProps("default_measurement_type")} data={node.data} />
          )}
        />

        {/* Labels column */}
        <Column
          field="labels"
          header={
            <div className="it-col-header">
              <span className="it-col-title">Labels</span>
              <div className="it-filter-row">
                <MultiSelectFilter
                  allOptions={all_label_names}
                  value={labelsColumnFilter}
                  onChange={setLabelsColumnFilter}
                  ariaLabel="Filter by labels"
                />
              </div>
            </div>
          }
          body={(node: IngredientTreeNode) => (
            <LabelsCell {...editProps("labels")} data={node.data} />
          )}
        />

        {/* Parent column */}
        <Column
          field="parent_name"
          header={<SortHeader label="Parent" field="parent_name" />}
          sortable
          body={(node: IngredientTreeNode) => (
            <ParentCell {...editProps("parent_name")} data={node.data} />
          )}
        />
      </TreeTable>
    </div>
  );
}
