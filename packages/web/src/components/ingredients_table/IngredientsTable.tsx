import {
  IngredientId,
  loadId,
  unitType,
  type Ingredient,
  type KitchenwareLabel,
  type KitchenwareLabelId,
  type Measurement,
  type MeasurementType,
  type MeasurementUnit,
} from "@recipe-book/shared";
import { Column } from "primereact/column";
import type { TreeNode } from "primereact/treenode";
import type { type } from "arktype";
import {
  TreeTable,
  type TreeTableExpandedKeysType,
  type TreeTableFilterMeta,
  type TreeTableSelectionKeysType,
} from "primereact/treetable";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { MeasurementEditor } from "../measurement/MeasurementEditor.js";
import { buildIngredientTree, type IngredientRow } from "./buildIngredientTree.js";
import { IngredientSelector } from "./IngredientSelector.js";
import "./IngredientsTable.css";
import { LabelEditor } from "./LabelEditor.js";
import { MultiSelectFilter } from "./MultiSelectFilter.js";

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

const MEASUREMENT_TYPES = ["count", "volume", "weight"] as const satisfies readonly MeasurementType[];

const UNIT_LABELS: Record<MeasurementUnit, string> = {
  tsp: "tsp", tbsp: "tbsp", fl_oz: "fl oz", cup: "cup",
  pint: "pint", quart: "quart", gallon: "gallon",
  ml: "ml", l: "L",
  oz: "oz", lb: "lb", g: "g", kg: "kg",
  whole: "whole", pinch: "pinch", dash: "dash",
};

const DEFAULT_BULK_MEASUREMENT: Measurement = { value: { numerator: 1, denominator: 1 }, unit: "cup" };

function formatMeasurement(m: Measurement): string {
  const { numerator: n, denominator: d } = m.value;
  const val = d === 1 ? `${n}` : `${n}/${d}`;
  return `${val} ${UNIT_LABELS[m.unit]}`;
}

type PKey = type.brand<string, "pkey">

function pkey(ingredient_id: IngredientId, col_id: string): PKey {
  return `${ingredient_id}|${col_id}` as PKey;
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
      ids.push(key as IngredientId);
    }
  }
  return ids;
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
  readonly onRemoveLabels: (
    ids: readonly IngredientId[],
    label_names: readonly string[],
  ) => void;
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

  const hasActiveFilter =
    nameFilter !== "" || typeFilter.length > 0 || labelFilter.length > 0;

  // Auto-expand every node while a filter is active so matched descendants
  // (which the table keeps via lenient mode) are actually visible.
  useEffect(() => {
    if (hasActiveFilter) {
      const all_keys: TreeTableExpandedKeysType = {};
      function collectKeys(nodes: TreeNode[]) {
        for (const n of nodes) {
          if (n.children && n.children.length > 0) {
            all_keys[String(n.key)] = true;
            collectKeys(n.children);
          }
        }
      }
      collectKeys(treeNodes);
      setExpandedKeys(all_keys);
    } else {
      setExpandedKeys({});
    }
  }, [hasActiveFilter, treeNodes]);

  // ---------------------------------------------------------------------------
  // Edit handlers
  // ---------------------------------------------------------------------------

  function onBeginEdit(ingredient_id: IngredientId, col_id: string, initial: string): void {
    setPendingEdits((prev) => new Map(prev).set(pkey(ingredient_id, col_id), initial));
  }

  function onUpdateEdit(ingredient_id: IngredientId, col_id: string, value: string): void {
    const key = pkey(ingredient_id, col_id);
    setPendingEdits((prev) => {
      if (!prev.has(key)) return prev;
      return new Map(prev).set(key, value);
    });
  }

  function onCommitEdit(ingredient_id: IngredientId, col_id: string): void {
    const key = pkey(ingredient_id, col_id);
    const value = pendingEdits.get(key);
    if (value === undefined) return;

    if (col_id === "name") {
      const trimmed = value.trim();
      if (trimmed !== "") onRename(ingredient_id, trimmed);
    } else if (col_id === "labels") {
      onSetLabels(ingredient_id, parseLabels(value));
    } else if (col_id === "parent_name") {
      onSetParent(ingredient_id, value !== "" ? (value as IngredientId) : undefined);
    }

    setPendingEdits((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }

  function onCancelEdit(ingredient_id: IngredientId, col_id: string): void {
    setPendingEdits((prev) => {
      const next = new Map(prev);
      next.delete(pkey(ingredient_id, col_id));
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Column body templates
  // ---------------------------------------------------------------------------

  function nameBody(node: TreeNode) {
    const row = node.data as IngredientRow;
    const pending = pendingEdits.get(pkey(row.id, "name"));
    if (pending !== undefined) {
      return (
        <span className="it-editing">
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
          <button
            type="button"
            className="it-confirm-btn"
            onClick={() => onCommitEdit(row.id, "name")}
            aria-label="Confirm edit"
          >
            ✔︎
          </button>
          <button
            type="button"
            className="it-cancel-btn"
            onClick={() => onCancelEdit(row.id, "name")}
            aria-label="Cancel edit"
          >
            ✗
          </button>
        </span>
      );
    }
    return (
      <span
        className="it-editable"
        role="button"
        tabIndex={0}
        aria-label={`Edit name for ${row.name}`}
        onClick={() => onBeginEdit(row.id, "name", row.name)}
        onKeyDown={(e: KeyboardEvent<HTMLSpanElement>) => {
          if (e.key === "Enter" || e.key === " ") onBeginEdit(row.id, "name", row.name);
        }}
      >
        {row.name}
      </span>
    );
  }

  function measurementBody(node: TreeNode) {
    const row = node.data as IngredientRow;
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
    const row = node.data as IngredientRow;
    const pending = pendingEdits.get(pkey(row.id, "labels"));
    const display = row.labels.join(", ");
    if (pending !== undefined) {
      return (
        <LabelEditor
          selectedLabelNames={parseLabels(pending)}
          allLabelNames={allLabelNames}
          ariaLabel={`Edit labels for ${row.name}`}
          onChange={(names) => onUpdateEdit(row.id, "labels", names.join(", "))}
          onCommit={() => onCommitEdit(row.id, "labels")}
          onCancel={() => onCancelEdit(row.id, "labels")}
        />
      );
    }
    return (
      <span
        className="it-editable"
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
    const row = node.data as IngredientRow;
    const pending = pendingEdits.get(pkey(row.id, "parent_name"));
    const display = row.parent_name || "— None -";
    if (pending !== undefined) {
      const pending_id = pending !== "" ? (pending as IngredientId) : undefined;
      return (
        <span className="it-editing">
          <IngredientSelector
            value={pending_id}
            options={ingredients.filter((i) => i.id !== row.id)}
            labels={labels}
            onChange={(id) => onUpdateEdit(row.id, "parent_name", id ?? "")}
            ariaLabel={`Edit parent for ${row.name}`}
            placeholder="— None —"
          />
          <button
            type="button"
            className="it-confirm-btn"
            onClick={() => onCommitEdit(row.id, "parent_name")}
            aria-label="Confirm edit"
          >
            ✔︎
          </button>
          <button
            type="button"
            className="it-cancel-btn"
            onClick={() => onCancelEdit(row.id, "parent_name")}
            aria-label="Cancel edit"
          >
            ✗
          </button>
        </span>
      );
    }
    return (
      <span
        className="it-editable"
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
      {selectedIds.length > 0 && (
        <div className="it-bulk-bar" role="region" aria-label="Bulk actions">
          <span className="it-bulk-count">{selectedIds.length} selected</span>
          <button
            type="button"
            className="it-bulk-clear"
            onClick={() => setSelectionKeys({})}
          >
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
              value={bulkParentId !== "" ? (bulkParentId as IngredientId) : undefined}
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
