import {
  IngredientId,
  loadId,
  unitType,
  validateAndPassthrough,
  type Ingredient,
  type KitchenwareLabel,
  type KitchenwareLabelId,
  type Measurement,
  type MeasurementType,
  type MeasurementUnit,
} from "@recipe-book/shared";
import type { type } from "arktype";
import { Column } from "primereact/column";
import type { TreeNode } from "primereact/treenode";
import {
  TreeTable,
  type TreeTableEvent,
  type TreeTableExpandedKeysType,
  type TreeTableFilterMeta,
  type TreeTableSelectionKeysType,
} from "primereact/treetable";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { MeasurementEditor } from "../measurement/MeasurementEditor.tsx";
import { buildIngredientTree, IngredientRow, IngredientRows } from "./buildIngredientTree.ts";
import { IngredientSelector } from "./IngredientSelector.tsx";
import "./IngredientsTable.css";
import { LabelEditor } from "./LabelEditor.tsx";
import { MultiSelectFilter } from "./MultiSelectFilter.tsx";

// ---------------------------------------------------------------------------
// External label filter
// ---------------------------------------------------------------------------

export interface ExternalLabelFilter {
  readonly label_ids: readonly KitchenwareLabelId[];
  readonly mode: "all" | "any";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MEASUREMENT_TYPES = [
  "count",
  "volume",
  "weight",
] as const satisfies readonly MeasurementType[];

const UNIT_LABELS: Record<MeasurementUnit, string> = {
  tsp: "tsp",
  tbsp: "tbsp",
  fl_oz: "fl oz",
  cup: "cup",
  pint: "pint",
  quart: "quart",
  gallon: "gallon",
  ml: "ml",
  l: "L",
  oz: "oz",
  lb: "lb",
  g: "g",
  kg: "kg",
  whole: "whole",
  pinch: "pinch",
  dash: "dash",
};

const DEFAULT_BULK_MEASUREMENT: Measurement = {
  value: { numerator: 1, denominator: 1 },
  unit: "cup",
};

function formatMeasurement(m: Measurement): string {
  const { numerator: n, denominator: d } = m.value;
  const val = d === 1 ? `${n}` : `${n}/${d}`;
  return `${val} ${UNIT_LABELS[m.unit]}`;
}

type PKey = type.brand<string, "pkey">;

function pkey(ingredientId: IngredientId, colId: string): PKey {
  return `${ingredientId}|${colId}` as PKey;
}

function parseLabels(raw: string): string[] {
  return raw
    .split(",")
    .map((l) => l.trim())
    .filter((l) => l !== "");
}

function toTreeNode(row: IngredientRow): TreeNode {
  return {
    key: row.id,
    data: row,
    children: row.subRows.length > 0 ? row.subRows.map(toTreeNode) : undefined,
  };
}

// TreeTable column filterFunctions — invoked per node with the resolved
// field value and the active filter value. Returning true keeps the node;
// the table itself walks the tree (lenient mode) to keep matching parents.

function typeFilterFunction(value: Measurement, selected: readonly string[]): boolean {
  if (selected.length === 0) return true;
  return selected.includes(unitType(value.unit) ?? "volume");
}

function labelsFilterFunction(value: readonly string[], selected: readonly string[]): boolean {
  if (selected.length === 0) return true;
  return selected.some((l) => value.includes(l));
}

// Every filter input below is a custom `filterElement` that drives the
// `filters` prop through component state, so the table never raises a real
// filter event. This handler exists only so TreeTable honours `filters`.
function noopFilter(): void {}

function extractSelectedIds(keys: TreeTableSelectionKeysType): IngredientId[] {
  const ids: IngredientId[] = [];
  for (const [key, val] of Object.entries(keys)) {
    if (typeof val === "object" && val !== null && val.checked === true) {
      ids.push(loadId(IngredientId, key));
    }
  }
  return ids;
}

// Returns true if the node itself matches all active filters (not via child).
function nodeMatchesFilters(
  row: IngredientRow,
  nameFilter: string,
  typeFilter: readonly string[],
  labelFilter: readonly string[],
): boolean {
  if (nameFilter !== "" && !row.name.toLowerCase().includes(nameFilter.toLowerCase())) return false;
  if (typeFilter.length > 0 && !typeFilterFunction(row.default_measurement_value, typeFilter))
    return false;
  if (labelFilter.length > 0 && !labelsFilterFunction(row.labels, labelFilter)) return false;
  return true;
}

// Collects selection keys for all nodes visible under lenient filtering:
// a node is included if it or any descendant matches. Returns checked=true
// for directly-matching nodes, partialChecked=true for ancestor-only matches.
function collectVisibleKeys(
  nodes: IngredientRow[],
  nameFilter: string,
  typeFilter: readonly string[],
  labelFilter: readonly string[],
  result: TreeTableSelectionKeysType,
): boolean {
  let anyMatch = false;
  for (const row of nodes) {
    const selfMatch = nodeMatchesFilters(row, nameFilter, typeFilter, labelFilter);
    const childMatch = collectVisibleKeys(row.subRows, nameFilter, typeFilter, labelFilter, result);
    if (selfMatch || childMatch) {
      result[row.id] = { checked: selfMatch, partialChecked: !selfMatch && childMatch };
      anyMatch = true;
    }
  }
  return anyMatch;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface IngredientsTableProps {
  readonly ingredients: readonly Ingredient[];
  readonly labels: readonly KitchenwareLabel[];
  readonly external_label_filter?: ExternalLabelFilter;
  readonly onRename: (id: IngredientId, name: string) => void;
  readonly onSetMeasurementValue: (id: IngredientId, value: Measurement) => void;
  readonly onSetLabels: (id: IngredientId, label_names: readonly string[]) => void;
  readonly onSetParent: (id: IngredientId, parent_id: IngredientId | undefined) => void;
  readonly onAddLabels: (ids: readonly IngredientId[], label_names: readonly string[]) => void;
  readonly onRemoveLabels: (ids: readonly IngredientId[], label_names: readonly string[]) => void;
  readonly onBulkSetMeasurementValue: (ids: readonly IngredientId[], value: Measurement) => void;
  readonly onBulkSetParent: (
    ids: readonly IngredientId[],
    parent_id: IngredientId | undefined,
  ) => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function IngredientsTable({
  ingredients,
  labels,
  external_label_filter,
  onRename,
  onSetMeasurementValue,
  onSetLabels,
  onSetParent,
  onAddLabels,
  onRemoveLabels,
  onBulkSetMeasurementValue,
  onBulkSetParent,
}: IngredientsTableProps) {
  const [expandedKeys, setExpandedKeys] = useState<TreeTableExpandedKeysType>({});
  const [selectionKeys, setSelectionKeys] = useState<TreeTableSelectionKeysType>({});
  const [pendingEdits, setPendingEdits] = useState<ReadonlyMap<PKey, string>>(new Map());
  const [nameFilter, setNameFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [labelFilter, setLabelFilter] = useState<string[]>([]);
  const [bulkAddLabels, setBulkAddLabels] = useState<readonly string[]>([]);
  const [bulkRemoveLabels, setBulkRemoveLabels] = useState<readonly string[]>([]);
  const [bulkMeasurement, setBulkMeasurement] = useState<Measurement | null>(null);
  const [bulkParentId, setBulkParentId] = useState("");
  const [editingMeasurementFor, setEditingMeasurementFor] = useState<IngredientId | null>(null);

  // Per-row timers used to debounce name-cell clicks so that a single click
  // (select) and a double-click (edit) are distinguishable.  Using a Map lets
  // rapid clicks on *different* rows each keep their own pending timer.
  const clickTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => {
    const timers = clickTimersRef.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const allLabelNames = useMemo(() => labels.map((l) => l.name).sort(), [labels]);

  const filteredIngredients = useMemo(() => {
    if (!external_label_filter || external_label_filter.label_ids.length === 0) {
      return ingredients;
    }
    const { label_ids, mode } = external_label_filter;
    return ingredients.filter((i) => {
      if (mode === "all") return label_ids.every((id) => i.labels.has(id));
      return label_ids.some((id) => i.labels.has(id));
    });
  }, [ingredients, external_label_filter]);

  const treeNodes = useMemo(() => {
    const rows = buildIngredientTree(filteredIngredients, labels);
    return rows.map(toTreeNode);
  }, [filteredIngredients, labels]);

  // TreeTable consults `filters` only when an `onFilter` handler is present.
  // Each entry is keyed by the column's `field`; blank filters are omitted so
  // the table skips filtering entirely when nothing is active.
  const treeFilters = useMemo<TreeTableFilterMeta>(() => {
    const filters: TreeTableFilterMeta = {};
    if (nameFilter !== "") {
      filters["name"] = { value: nameFilter, matchMode: "contains" };
    }
    if (typeFilter.length > 0) {
      filters["default_measurement_value"] = { value: typeFilter, matchMode: "custom" };
    }
    if (labelFilter.length > 0) {
      filters["labels"] = { value: labelFilter, matchMode: "custom" };
    }
    return filters;
  }, [nameFilter, typeFilter, labelFilter]);

  const hasActiveFilter = nameFilter !== "" || typeFilter.length > 0 || labelFilter.length > 0;

  // Auto-expand every node while a filter is active so matched descendants
  // (which the table keeps via lenient mode) are actually visible.
  useEffect(() => {
    if (hasActiveFilter) {
      const allKeys: TreeTableExpandedKeysType = {};
      function collectKeys(nodes: TreeNode[]) {
        for (const n of nodes) {
          if (n.children && n.children.length > 0) {
            allKeys[String(n.key)] = true;
            collectKeys(n.children);
          }
        }
      }
      collectKeys(treeNodes);
      setExpandedKeys(allKeys);
    } else {
      setExpandedKeys({});
    }
  }, [hasActiveFilter, treeNodes]);

  // ---------------------------------------------------------------------------
  // Selection helpers
  // ---------------------------------------------------------------------------

  function toggleRowSelection(nodeKey: string): void {
    setSelectionKeys((prev) => {
      const next: TreeTableSelectionKeysType = { ...prev };
      const current = next[nodeKey];
      if (typeof current === "object" && current !== null && current.checked) {
        delete next[nodeKey];
      } else {
        next[nodeKey] = { checked: true, partialChecked: false };
      }
      return next;
    });
  }

  function handleRowClick(event: TreeTableEvent): void {
    const key = event.node?.key;
    if (key == null) {
      console.warn("Missing event.node.key property from row click event", event);
      return;
    }
    const target = event.originalEvent.target as HTMLElement;
    if (
      target.closest("input") !== null ||
      target.closest("button") !== null ||
      target.closest("[data-editable]") !== null ||
      target.closest("[data-editing]") !== null
    ) {
      return;
    }
    toggleRowSelection(String(key));
  }

  // ---------------------------------------------------------------------------
  // Edit handlers
  // ---------------------------------------------------------------------------

  function onBeginEdit(ingredientId: IngredientId, colId: string, initial: string): void {
    setPendingEdits((prev) => new Map(prev).set(pkey(ingredientId, colId), initial));
  }

  function onUpdateEdit(ingredientId: IngredientId, colId: string, value: string): void {
    const key = pkey(ingredientId, colId);
    setPendingEdits((prev) => {
      if (!prev.has(key)) return prev;
      return new Map(prev).set(key, value);
    });
  }

  function onCommitEdit(ingredientId: IngredientId, colId: string): void {
    const key = pkey(ingredientId, colId);
    const value = pendingEdits.get(key);
    if (value === undefined) return;

    if (colId === "name") {
      const trimmed = value.trim();
      if (trimmed !== "") onRename(ingredientId, trimmed);
    } else if (colId === "labels") {
      onSetLabels(ingredientId, parseLabels(value));
    } else if (colId === "parent_name") {
      onSetParent(ingredientId, value !== "" ? loadId(IngredientId, value) : undefined);
    }

    setPendingEdits((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }

  function onCancelEdit(ingredientId: IngredientId, colId: string): void {
    setPendingEdits((prev) => {
      const next = new Map(prev);
      next.delete(pkey(ingredientId, colId));
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Column body templates
  // ---------------------------------------------------------------------------
  // The name column uses single-click to select and double-click to edit to avoid
  // accidental renames. Other columns (measurement, labels, parent) retain single-click
  // edit because their specialized inline editors are harder to trigger accidentally.

  function nameBody(node: TreeNode) {
    const [row] = validateAndPassthrough(IngredientRow, node.data);
    const pending = pendingEdits.get(pkey(row.id, "name"));
    if (pending !== undefined) {
      return (
        <span className="it-editing" data-editing>
          <input
            type="text"
            value={pending}
            className="it-edit-input"
            autoFocus
            aria-label={`Edit name for ${row.name}`}
            onChange={(e) => onUpdateEdit(row.id, "name", e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") onCommitEdit(row.id, "name");
              if (e.key === "Escape") onCancelEdit(row.id, "name");
            }}
          />
          <div className="it-edit-buttons">
            <button
              type="button"
              className="it-cancel-btn"
              onClick={() => onCancelEdit(row.id, "name")}
              aria-label="Cancel edit"
            >
              ↩
            </button>
            <button
              type="button"
              className="it-confirm-btn"
              onClick={() => onCommitEdit(row.id, "name")}
              aria-label="Confirm edit"
            >
              ✔︎
            </button>
          </div>
        </span>
      );
    }
    return (
      <span
        className="it-editable"
        data-editable
        role="button"
        tabIndex={0}
        aria-label={`Edit name for ${row.name}`}
        onClick={(e) => {
          e.stopPropagation();
          // Delay the selection action so a rapid second click can cancel it.
          // A dblclick fires two click events before the dblclick event; without
          // this debounce the row would toggle twice (net no-op) and the editor
          // would open in an unintentionally modified selection state.
          const timers = clickTimersRef.current;
          const existing = timers.get(row.id);
          if (existing !== undefined) clearTimeout(existing);
          timers.set(
            row.id,
            setTimeout(() => {
              timers.delete(row.id);
              toggleRowSelection(row.id);
            }, 250),
          );
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          // Cancel the pending single-click selection so the row is not
          // inadvertently toggled.  Selecting and editing are separate
          // operations; opening the editor does not implicitly select the row.
          const timers = clickTimersRef.current;
          const existing = timers.get(row.id);
          if (existing !== undefined) {
            clearTimeout(existing);
            timers.delete(row.id);
          }
          onBeginEdit(row.id, "name", row.name);
        }}
        onKeyDown={(e: KeyboardEvent<HTMLSpanElement>) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleRowSelection(row.id);
          }
          if (e.key === "F2") onBeginEdit(row.id, "name", row.name);
        }}
      >
        {row.name}
      </span>
    );
  }

  function measurementBody(node: TreeNode) {
    const [row] = validateAndPassthrough(IngredientRow, node.data);
    if (editingMeasurementFor === row.id) {
      return (
        <MeasurementEditor
          value={row.default_measurement_value}
          initiallyOpen
          onCommit={(value) => {
            onSetMeasurementValue(row.id, value);
            setEditingMeasurementFor(null);
          }}
          onCancel={() => setEditingMeasurementFor(null)}
        />
      );
    }
    return (
      <span
        className="it-editable"
        data-editable
        role="button"
        tabIndex={0}
        aria-label={`Edit default measurement for ${row.name}`}
        onClick={() => setEditingMeasurementFor(row.id)}
        onKeyDown={(e: KeyboardEvent<HTMLSpanElement>) => {
          if (e.key === "Enter" || e.key === " ") setEditingMeasurementFor(row.id);
        }}
      >
        {formatMeasurement(row.default_measurement_value)}
      </span>
    );
  }

  function labelsBody(node: TreeNode) {
    const [row] = validateAndPassthrough(IngredientRow, node.data);
    const pending = pendingEdits.get(pkey(row.id, "labels"));
    const display = row.labels.join(", ");
    if (pending !== undefined) {
      return (
        <LabelEditor
          selectedLabelNames={parseLabels(pending)}
          allLabelNames={allLabelNames}
          ariaLabel={`Edit labels for ${row.name}`}
          autoFocus
          onChange={(names) => onUpdateEdit(row.id, "labels", names.join(", "))}
          onCommit={() => onCommitEdit(row.id, "labels")}
          onCancel={() => onCancelEdit(row.id, "labels")}
        />
      );
    }
    return (
      <span
        className="it-editable"
        data-editable
        role="button"
        tabIndex={0}
        aria-label={`Edit labels for ${row.name}`}
        onClick={() => onBeginEdit(row.id, "labels", display)}
        onKeyDown={(e: KeyboardEvent<HTMLSpanElement>) => {
          if (e.key === "Enter" || e.key === " ") onBeginEdit(row.id, "labels", display);
        }}
      >
        {display || <span className="it-muted">—</span>}
      </span>
    );
  }

  function parentBody(node: TreeNode) {
    const [row] = validateAndPassthrough(IngredientRow, node.data);
    const pending = pendingEdits.get(pkey(row.id, "parent_name"));
    const display = row.parent_name || "— None —";
    if (pending !== undefined) {
      const pendingId = pending !== "" ? loadId(IngredientId, pending) : undefined;
      return (
        <span className="it-editing" data-editing>
          <IngredientSelector
            value={pendingId}
            options={ingredients.filter((i) => i.id !== row.id)}
            labels={labels}
            onChange={(id) => onUpdateEdit(row.id, "parent_name", id ?? "")}
            ariaLabel={`Edit parent for ${row.name}`}
            placeholder="— None —"
          />
          <div className="it-edit-buttons">
            <button
              type="button"
              className="it-cancel-btn"
              onClick={() => onCancelEdit(row.id, "parent_name")}
              aria-label="Cancel edit"
            >
              ↩
            </button>
            <button
              type="button"
              className="it-confirm-btn"
              onClick={() => onCommitEdit(row.id, "parent_name")}
              aria-label="Confirm edit"
            >
              ✔︎
            </button>
          </div>
        </span>
      );
    }
    return (
      <span
        className="it-editable"
        data-editable
        role="button"
        tabIndex={0}
        aria-label={`Edit parent for ${row.name}`}
        onClick={() => onBeginEdit(row.id, "parent_name", row.parent_id ?? "")}
        onKeyDown={(e: KeyboardEvent<HTMLSpanElement>) => {
          if (e.key === "Enter" || e.key === " ")
            onBeginEdit(row.id, "parent_name", row.parent_id ?? "");
        }}
      >
        {display}
      </span>
    );
  }

  // ---------------------------------------------------------------------------
  // Bulk actions
  // ---------------------------------------------------------------------------

  const selectedIds = useMemo(() => extractSelectedIds(selectionKeys), [selectionKeys]);

  function selectAllVisible(): void {
    const result: TreeTableSelectionKeysType = {};
    const [rows] = validateAndPassthrough(
      IngredientRows,
      treeNodes.map((n) => n.data),
    );
    collectVisibleKeys(rows, nameFilter, typeFilter, labelFilter, result);
    setSelectionKeys(result);
  }

  function applyAddLabels(): void {
    if (bulkAddLabels.length > 0) {
      onAddLabels(selectedIds, bulkAddLabels);
      setBulkAddLabels([]);
    }
  }

  function applyRemoveLabels(): void {
    if (bulkRemoveLabels.length > 0) {
      onRemoveLabels(selectedIds, bulkRemoveLabels);
      setBulkRemoveLabels([]);
    }
  }

  function applyBulkParent(): void {
    if (bulkParentId !== "") {
      onBulkSetParent(selectedIds, loadId(IngredientId, bulkParentId));
      setBulkParentId("");
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="it-wrapper" role="region" aria-label="Ingredient list">
      <div className="it-toolbar">
        <button type="button" className="it-select-all-btn" onClick={selectAllVisible}>
          Select all
        </button>
        {selectedIds.length > 0 && (
          <button
            type="button"
            className="it-clear-sel-btn"
            onClick={() => setSelectionKeys({})}
            aria-label="Clear selection"
          >
            Clear selection
          </button>
        )}
      </div>
      {selectedIds.length > 0 && (
        <div className="it-bulk-bar" role="region" aria-label="Bulk actions">
          <span className="it-bulk-count">{selectedIds.length} selected</span>
          <button type="button" className="it-bulk-clear" onClick={() => setSelectionKeys({})}>
            Clear
          </button>

          <span className="it-bulk-action">
            <LabelEditor
              selectedLabelNames={bulkAddLabels}
              allLabelNames={allLabelNames}
              ariaLabel="Labels to add"
              placeholder="Labels to add…"
              commitAriaLabel="Apply add labels"
              commitDisabled={bulkAddLabels.length === 0}
              onChange={(names) => setBulkAddLabels(names)}
              onCommit={applyAddLabels}
              onCancel={() => setBulkAddLabels([])}
            />
          </span>

          <span className="it-bulk-action">
            <LabelEditor
              selectedLabelNames={bulkRemoveLabels}
              allLabelNames={allLabelNames}
              ariaLabel="Labels to remove"
              placeholder="Labels to remove…"
              commitAriaLabel="Apply remove labels"
              commitDisabled={bulkRemoveLabels.length === 0}
              onChange={(names) => setBulkRemoveLabels(names)}
              onCommit={applyRemoveLabels}
              onCancel={() => setBulkRemoveLabels([])}
            />
          </span>

          <span className="it-bulk-action">
            <MeasurementEditor
              value={bulkMeasurement ?? DEFAULT_BULK_MEASUREMENT}
              onCommit={(value) => {
                setBulkMeasurement(value);
                onBulkSetMeasurementValue(selectedIds, value);
              }}
              onCancel={() => setBulkMeasurement(null)}
            />
          </span>

          <span className="it-bulk-action">
            <IngredientSelector
              value={bulkParentId !== "" ? loadId(IngredientId, bulkParentId) : undefined}
              options={ingredients}
              labels={labels}
              onChange={(id) => setBulkParentId(id ?? "")}
              ariaLabel="Bulk parent"
              placeholder="— Parent —"
            />
            <button
              type="button"
              className="it-bulk-apply"
              disabled={bulkParentId === ""}
              onClick={applyBulkParent}
              aria-label="Apply parent change"
            >
              Change parent
            </button>
            <button
              type="button"
              className="it-bulk-apply"
              onClick={() => {
                onBulkSetParent(selectedIds, undefined);
              }}
              aria-label="Clear parent"
            >
              Clear parent
            </button>
          </span>
        </div>
      )}

      <TreeTable
        value={treeNodes}
        expandedKeys={expandedKeys}
        onToggle={(e) => setExpandedKeys(e.value)}
        selectionMode="checkbox"
        selectionKeys={selectionKeys}
        onSelectionChange={(e) => {
          if (typeof e.value === "object" && e.value !== null && !Array.isArray(e.value)) {
            setSelectionKeys(e.value as TreeTableSelectionKeysType);
          }
        }}
        onRowClick={handleRowClick}
        filters={treeFilters}
        filterMode="lenient"
        onFilter={noopFilter}
        tableClassName="it-table"
        emptyMessage="No ingredients match the current filter."
      >
        <Column
          field="name"
          header="Name"
          expander
          sortable
          body={nameBody}
          filter
          filterMatchMode="contains"
          filterHeaderClassName="it-filter-th"
          filterElement={
            <input
              type="text"
              className="it-col-filter"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="Filter by name…"
              aria-label="Filter by name"
            />
          }
        />
        <Column
          field="default_measurement_value"
          header="Default Value"
          sortable
          body={measurementBody}
          filter
          filterMatchMode="custom"
          filterFunction={typeFilterFunction}
          filterHeaderClassName="it-filter-th"
          filterElement={
            <MultiSelectFilter
              value={typeFilter}
              onChange={setTypeFilter}
              allOptions={MEASUREMENT_TYPES}
              ariaLabel="Filter by type"
            />
          }
        />
        <Column
          field="labels"
          header="Labels"
          body={labelsBody}
          filter
          filterMatchMode="custom"
          filterFunction={labelsFilterFunction}
          filterHeaderClassName="it-filter-th"
          filterElement={
            <MultiSelectFilter
              value={labelFilter}
              onChange={setLabelFilter}
              allOptions={allLabelNames}
              ariaLabel="Filter by labels"
            />
          }
        />
        <Column field="parent_name" header="Parent" sortable body={parentBody} />
      </TreeTable>
    </div>
  );
}
