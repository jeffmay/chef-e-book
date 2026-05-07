import { useState, useMemo, useEffect, useRef, type KeyboardEvent } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  createColumnHelper,
  flexRender,
  type ColumnFiltersState,
  type SortingState,
  type GroupingState,
  type ExpandedState,
  type FilterFn,
  type RowData,
  type CellContext,
  type Header,
  type Table,
} from "@tanstack/react-table";
import type { Ingredient, ItemLabel, MeasurementType } from "@recipe-book/shared";
import { MultiSelectFilter } from "./MultiSelectFilter.js";
import { build_ingredient_tree, type IngredientRow } from "./build_ingredient_tree.js";
import "./IngredientsTable.css";

// ---------------------------------------------------------------------------
// External label filter (driven by LabelTable)
// ---------------------------------------------------------------------------

export interface ExternalLabelFilter {
  readonly label_ids: readonly ItemLabel.Id[];
  readonly mode: "all" | "any";
}

// ---------------------------------------------------------------------------
// Module augmentations
// ---------------------------------------------------------------------------

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    pending_edits: Map<string, string>;
    on_begin_edit: (ingredient_id: Ingredient.Id, col_id: string, initial: string) => void;
    on_update_edit: (ingredient_id: Ingredient.Id, col_id: string, value: string) => void;
    on_commit_edit: (ingredient_id: Ingredient.Id, col_id: string) => void;
    on_cancel_edit: (ingredient_id: Ingredient.Id, col_id: string) => void;
    all_ingredients: readonly Ingredient[];
    selected_ids: ReadonlySet<Ingredient.Id>;
    on_toggle_select: (id: Ingredient.Id) => void;
    on_toggle_select_all: (ids: readonly Ingredient.Id[]) => void;
  }
  interface FilterFns {
    fuzzy_text: FilterFn<IngredientRow>;
    multi_select: FilterFn<IngredientRow>;
    name_recursive_fuzzy: FilterFn<IngredientRow>;
  }
}

// ---------------------------------------------------------------------------
// Filter functions
// ---------------------------------------------------------------------------

const fuzzy_text: FilterFn<IngredientRow> = (row, col_id, value) => {
  if (typeof value !== "string" || value === "") return true;
  return String(row.getValue(col_id)).toLowerCase().includes(value.toLowerCase());
};
fuzzy_text.autoRemove = (v) => typeof v !== "string" || v === "";

const multi_select: FilterFn<IngredientRow> = (row, col_id, value) => {
  if (!Array.isArray(value) || value.length === 0) return true;
  const selected = value.filter((v): v is string => typeof v === "string");
  if (selected.length === 0) return true;
  const cell = row.getValue(col_id);
  const values: string[] = Array.isArray(cell)
    ? cell.filter((v): v is string => typeof v === "string")
    : [String(cell)];
  return selected.some((s) => values.includes(s));
};
multi_select.autoRemove = (v) => !Array.isArray(v) || v.length === 0;

function row_name_matches(row_data: IngredientRow, query: string): boolean {
  if (row_data.name.toLowerCase().includes(query)) return true;
  return row_data.subRows.some((child) => row_name_matches(child, query));
}

const name_recursive_fuzzy: FilterFn<IngredientRow> = (row, _col_id, value) => {
  if (typeof value !== "string" || value === "") return true;
  return row_name_matches(row.original, value.toLowerCase());
};
name_recursive_fuzzy.autoRemove = (v) => typeof v !== "string" || v === "";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pkey(ingredient_id: Ingredient.Id, col_id: string): string {
  return `${ingredient_id}|${col_id}`;
}

const MEASUREMENT_TYPES: readonly MeasurementType[] = ["count", "volume", "weight"];

function validate_type(v: string): MeasurementType | undefined {
  if (v === "volume" || v === "weight" || v === "count") return v;
  return undefined;
}

function parse_labels(raw: string): string[] {
  return raw
    .split(",")
    .map((l) => l.trim())
    .filter((l) => l !== "");
}

// ---------------------------------------------------------------------------
// Editable cell components
// ---------------------------------------------------------------------------

function NameCell({ getValue, row, column, table }: CellContext<IngredientRow, string>) {
  const value = getValue();
  const meta = table.options.meta!;
  const key = pkey(row.original.id, column.id);
  const pending = meta.pending_edits.get(key);

  if (pending !== undefined) {
    return (
      <span className="it-editing">
        <input
          type="text"
          value={pending}
          className="it-edit-input"
          autoFocus
          aria-label={`Edit name for ${value}`}
          onChange={(e) => meta.on_update_edit(row.original.id, column.id, e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") meta.on_commit_edit(row.original.id, column.id);
            if (e.key === "Escape") meta.on_cancel_edit(row.original.id, column.id);
          }}
        />
        <button
          type="button"
          className="it-confirm-btn"
          onClick={() => meta.on_commit_edit(row.original.id, column.id)}
          aria-label="Confirm edit"
        >
          ✔︎
        </button>
        <button
          type="button"
          className="it-cancel-btn"
          onClick={() => meta.on_cancel_edit(row.original.id, column.id)}
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
      aria-label={`Edit name for ${value}`}
      onClick={() => meta.on_begin_edit(row.original.id, column.id, value)}
      onKeyDown={(e: KeyboardEvent<HTMLSpanElement>) => {
        if (e.key === "Enter" || e.key === " ")
          meta.on_begin_edit(row.original.id, column.id, value);
      }}
    >
      {value}
    </span>
  );
}

function TypeCell({ getValue, row, column, table }: CellContext<IngredientRow, MeasurementType>) {
  const value = getValue();
  const meta = table.options.meta!;
  const key = pkey(row.original.id, column.id);
  const pending = meta.pending_edits.get(key);

  if (pending !== undefined) {
    return (
      <span className="it-editing">
        <select
          value={pending}
          autoFocus
          aria-label={`Edit type for ${row.original.name}`}
          onChange={(e) => meta.on_update_edit(row.original.id, column.id, e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLSelectElement>) => {
            if (e.key === "Escape") meta.on_cancel_edit(row.original.id, column.id);
          }}
        >
          {MEASUREMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="it-confirm-btn"
          onClick={() => meta.on_commit_edit(row.original.id, column.id)}
          aria-label="Confirm edit"
        >
          ✔︎
        </button>
        <button
          type="button"
          className="it-cancel-btn"
          onClick={() => meta.on_cancel_edit(row.original.id, column.id)}
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
      aria-label={`Edit type for ${row.original.name}`}
      onClick={() => meta.on_begin_edit(row.original.id, column.id, value)}
      onKeyDown={(e: KeyboardEvent<HTMLSpanElement>) => {
        if (e.key === "Enter" || e.key === " ")
          meta.on_begin_edit(row.original.id, column.id, value);
      }}
    >
      {value}
    </span>
  );
}

function LabelsCell({
  getValue,
  row,
  column,
  table,
}: CellContext<IngredientRow, readonly string[]>) {
  const labels = getValue();
  const display = labels.join(", ");
  const meta = table.options.meta!;
  const key = pkey(row.original.id, column.id);
  const pending = meta.pending_edits.get(key);

  if (pending !== undefined) {
    return (
      <span className="it-editing">
        <input
          type="text"
          value={pending}
          className="it-edit-input it-edit-input--wide"
          autoFocus
          placeholder="label1, label2"
          aria-label={`Edit labels for ${row.original.name}`}
          onChange={(e) => meta.on_update_edit(row.original.id, column.id, e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") meta.on_commit_edit(row.original.id, column.id);
            if (e.key === "Escape") meta.on_cancel_edit(row.original.id, column.id);
          }}
        />
        <button
          type="button"
          className="it-confirm-btn"
          onClick={() => meta.on_commit_edit(row.original.id, column.id)}
          aria-label="Confirm edit"
        >
          ✔︎
        </button>
        <button
          type="button"
          className="it-cancel-btn"
          onClick={() => meta.on_cancel_edit(row.original.id, column.id)}
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
      aria-label={`Edit labels for ${row.original.name}`}
      onClick={() => meta.on_begin_edit(row.original.id, column.id, display)}
      onKeyDown={(e: KeyboardEvent<HTMLSpanElement>) => {
        if (e.key === "Enter" || e.key === " ")
          meta.on_begin_edit(row.original.id, column.id, display);
      }}
    >
      {display || <span className="it-muted">—</span>}
    </span>
  );
}

function ParentCell({ row, column, table }: CellContext<IngredientRow, string>) {
  const meta = table.options.meta!;
  const key = pkey(row.original.id, column.id);
  const pending = meta.pending_edits.get(key);
  const display = row.original.parent_name || "—";

  if (pending !== undefined) {
    return (
      <span className="it-editing">
        <select
          value={pending}
          autoFocus
          aria-label={`Edit parent for ${row.original.name}`}
          onChange={(e) => meta.on_update_edit(row.original.id, column.id, e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLSelectElement>) => {
            if (e.key === "Escape") meta.on_cancel_edit(row.original.id, column.id);
          }}
        >
          <option value="">— None —</option>
          {meta.all_ingredients
            .filter((i) => i.id !== row.original.id)
            .map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
        </select>
        <button
          type="button"
          className="it-confirm-btn"
          onClick={() => meta.on_commit_edit(row.original.id, column.id)}
          aria-label="Confirm edit"
        >
          ✔︎
        </button>
        <button
          type="button"
          className="it-cancel-btn"
          onClick={() => meta.on_cancel_edit(row.original.id, column.id)}
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
      aria-label={`Edit parent for ${row.original.name}`}
      onClick={() =>
        meta.on_begin_edit(row.original.id, column.id, row.original.parent_id ?? "")
      }
      onKeyDown={(e: KeyboardEvent<HTMLSpanElement>) => {
        if (e.key === "Enter" || e.key === " ")
          meta.on_begin_edit(row.original.id, column.id, row.original.parent_id ?? "");
      }}
    >
      {display}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Select-all checkbox (needs useRef for indeterminate state)
// ---------------------------------------------------------------------------

function SelectAllCheckbox({ table }: { table: Table<IngredientRow> }) {
  const meta = table.options.meta!;
  const all_ids = table
    .getFilteredRowModel()
    .flatRows.filter((r) => !r.getIsGrouped())
    .map((r) => r.original.id);
  const ref = useRef<HTMLInputElement>(null);
  const all_selected = all_ids.length > 0 && all_ids.every((id) => meta.selected_ids.has(id));
  const some_selected = all_ids.some((id) => meta.selected_ids.has(id));

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = some_selected && !all_selected;
    }
  }, [some_selected, all_selected]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={all_selected}
      onChange={() => meta.on_toggle_select_all(all_ids)}
      aria-label="Select all ingredients"
    />
  );
}

// ---------------------------------------------------------------------------
// Column header
// ---------------------------------------------------------------------------

interface ColumnHeaderProps {
  readonly header: Header<IngredientRow, unknown>;
  readonly all_labels: readonly string[];
}

function ColumnHeader({ header, all_labels }: ColumnHeaderProps) {
  const col = header.column;
  const sorted = col.getIsSorted();
  const is_grouped = col.getIsGrouped();
  const filter_value = col.getFilterValue();
  const filter_str = typeof filter_value === "string" ? filter_value : "";

  return (
    <div className="it-col-header">
      <div className="it-col-title">
        {col.getCanSort() ? (
          <button
            type="button"
            className="it-sort-btn"
            onClick={col.getToggleSortingHandler()}
            aria-label={`Sort by ${col.id}`}
          >
            {flexRender(col.columnDef.header, header.getContext())}
            <span className="it-sort-icon" aria-hidden>
              {sorted === "asc" ? " ↑" : sorted === "desc" ? " ↓" : " ↕"}
            </span>
          </button>
        ) : (
          <span>{flexRender(col.columnDef.header, header.getContext())}</span>
        )}
        {col.getCanGroup() && (
          <button
            type="button"
            className={`it-group-btn${is_grouped ? " it-group-btn--on" : ""}`}
            onClick={col.getToggleGroupingHandler()}
            aria-label={`${is_grouped ? "Ungroup" : "Group"} by ${col.id}`}
            title={is_grouped ? "Remove grouping" : "Group by this column"}
          >
            {is_grouped ? "⊟" : "⊞"}
          </button>
        )}
      </div>
      {col.getCanFilter() && (
        <div className="it-filter-row">
          {col.id === "default_measurement_type" ? (
            <MultiSelectFilter
              column={col}
              all_options={MEASUREMENT_TYPES}
              aria_label="Filter by type"
            />
          ) : col.id === "labels" ? (
            <MultiSelectFilter
              column={col}
              all_options={all_labels}
              aria_label="Filter by labels"
            />
          ) : (
            <input
              type="text"
              className="it-text-filter"
              value={filter_str}
              onChange={(e) => col.setFilterValue(e.target.value || undefined)}
              placeholder="Filter…"
              aria-label={col.id === "name" ? "Filter by name" : `Filter by ${col.id}`}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column definitions (static — dynamic data passed via meta / ColumnHeader props)
// ---------------------------------------------------------------------------

const col = createColumnHelper<IngredientRow>();

const COLUMNS = [
  col.display({
    id: "select",
    enableSorting: false,
    enableGrouping: false,
    enableColumnFilter: false,
    header: ({ table }) => <SelectAllCheckbox table={table} />,
    cell: ({ row, table }) => {
      if (row.getIsGrouped()) return null;
      const meta = table.options.meta!;
      return (
        <input
          type="checkbox"
          checked={meta.selected_ids.has(row.original.id)}
          onChange={() => meta.on_toggle_select(row.original.id)}
          aria-label={`Select ${row.original.name}`}
        />
      );
    },
  }),
  col.display({
    id: "expand",
    enableSorting: false,
    enableGrouping: false,
    enableColumnFilter: false,
    header: () => null,
    cell: ({ row }) => {
      const can = row.getCanExpand();
      const open = row.getIsExpanded();
      const name = row.getIsGrouped() ? "group" : row.original.name;
      return (
        <div
          className="it-expand-cell"
          style={row.getIsGrouped() ? undefined : { paddingLeft: `${row.depth * 1.5}em` }}
        >
          {can ? (
            <button
              type="button"
              className="it-expand-btn"
              onClick={row.getToggleExpandedHandler()}
              aria-label={`${open ? "Collapse" : "Expand"} ${name}`}
            >
              {open ? "▼" : "▶"}
            </button>
          ) : (
            <span className="it-expand-spacer" aria-hidden />
          )}
        </div>
      );
    },
  }),
  col.accessor("name", {
    header: "Name",
    filterFn: "name_recursive_fuzzy",
    enableGrouping: true,
    cell: NameCell,
  }),
  col.accessor("default_measurement_type", {
    header: "Type",
    filterFn: "multi_select",
    enableGrouping: true,
    cell: TypeCell,
  }),
  col.accessor((row) => row.labels, {
    id: "labels",
    header: "Labels",
    filterFn: "multi_select",
    enableGrouping: false,
    enableSorting: false,
    cell: LabelsCell,
  }),
  col.accessor("parent_name", {
    header: "Parent",
    enableColumnFilter: false,
    enableGrouping: true,
    cell: ParentCell,
  }),
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface IngredientsTableProps {
  readonly ingredients: readonly Ingredient[];
  readonly labels: readonly ItemLabel[];
  readonly external_label_filter?: ExternalLabelFilter;
  readonly on_rename: (id: Ingredient.Id, name: string) => void;
  readonly on_set_type: (id: Ingredient.Id, type: MeasurementType) => void;
  readonly on_set_labels: (id: Ingredient.Id, label_names: readonly string[]) => void;
  readonly on_set_parent: (id: Ingredient.Id, parent_id: Ingredient.Id | undefined) => void;
  readonly on_add_labels: (ids: readonly Ingredient.Id[], label_names: readonly string[]) => void;
  readonly on_remove_labels: (
    ids: readonly Ingredient.Id[],
    label_names: readonly string[],
  ) => void;
  readonly on_bulk_set_type: (ids: readonly Ingredient.Id[], type: MeasurementType) => void;
  readonly on_bulk_set_parent: (
    ids: readonly Ingredient.Id[],
    parent_id: Ingredient.Id | undefined,
  ) => void;
}

export function IngredientsTable({
  ingredients,
  labels,
  external_label_filter,
  on_rename,
  on_set_type,
  on_set_labels,
  on_set_parent,
  on_add_labels,
  on_remove_labels,
  on_bulk_set_type,
  on_bulk_set_parent,
}: IngredientsTableProps) {
  const [column_filters, set_column_filters] = useState<ColumnFiltersState>([]);
  const [sorting, set_sorting] = useState<SortingState>([]);
  const [grouping, set_grouping] = useState<GroupingState>([]);
  const [expanded, set_expanded] = useState<ExpandedState>({});
  const [pending_edits, set_pending_edits] = useState<Map<string, string>>(new Map());
  const [selected_ids, set_selected_ids] = useState<Set<Ingredient.Id>>(new Set());
  const [bulk_add_labels, set_bulk_add_labels] = useState("");
  const [bulk_remove_labels, set_bulk_remove_labels] = useState("");
  const [bulk_type, set_bulk_type] = useState("");
  const [bulk_parent_id, set_bulk_parent_id] = useState("");

  const all_label_names = useMemo(() => labels.map((l) => l.name).sort(), [labels]);

  // Apply external label filter from LabelTable before building tree
  const filtered_ingredients = useMemo(() => {
    if (!external_label_filter || external_label_filter.label_ids.length === 0) {
      return ingredients;
    }
    const { label_ids, mode } = external_label_filter;
    return ingredients.filter((i) => {
      if (mode === "all") return label_ids.every((id) => i.labels.has(id));
      return label_ids.some((id) => i.labels.has(id));
    });
  }, [ingredients, external_label_filter]);

  const data = useMemo(
    () => build_ingredient_tree(filtered_ingredients, labels),
    [filtered_ingredients, labels],
  );

  // Auto-expand rows when a name filter is active so matching children are visible
  useEffect(() => {
    const name_filter = column_filters.find((f) => f.id === "name")?.value;
    if (typeof name_filter === "string" && name_filter !== "") {
      set_expanded(true);
    } else {
      set_expanded({});
    }
  }, [column_filters]);

  function on_begin_edit(ingredient_id: Ingredient.Id, col_id: string, initial: string): void {
    set_pending_edits((prev) => new Map(prev).set(pkey(ingredient_id, col_id), initial));
  }

  function on_update_edit(ingredient_id: Ingredient.Id, col_id: string, value: string): void {
    const key = pkey(ingredient_id, col_id);
    set_pending_edits((prev) => {
      if (!prev.has(key)) return prev;
      return new Map(prev).set(key, value);
    });
  }

  function on_commit_edit(ingredient_id: Ingredient.Id, col_id: string): void {
    const key = pkey(ingredient_id, col_id);
    const value = pending_edits.get(key);
    if (value === undefined) return;

    if (col_id === "name") {
      const trimmed = value.trim();
      if (trimmed !== "") on_rename(ingredient_id, trimmed);
    } else if (col_id === "default_measurement_type") {
      const type = validate_type(value);
      if (type !== undefined) on_set_type(ingredient_id, type);
    } else if (col_id === "labels") {
      on_set_labels(ingredient_id, parse_labels(value));
    } else if (col_id === "parent_name") {
      on_set_parent(ingredient_id, value !== "" ? (value as Ingredient.Id) : undefined);
    }

    set_pending_edits((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }

  function on_cancel_edit(ingredient_id: Ingredient.Id, col_id: string): void {
    const key = pkey(ingredient_id, col_id);
    set_pending_edits((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }

  function toggle_select(id: Ingredient.Id): void {
    set_selected_ids((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggle_select_all(ids: readonly Ingredient.Id[]): void {
    set_selected_ids((prev) => {
      const all_selected = ids.length > 0 && ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (all_selected) {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
      return next;
    });
  }

  const table = useReactTable({
    data,
    columns: COLUMNS,
    state: { columnFilters: column_filters, sorting, grouping, expanded },
    onColumnFiltersChange: set_column_filters,
    onSortingChange: set_sorting,
    onGroupingChange: set_grouping,
    onExpandedChange: set_expanded,
    getSubRows: (row) => row.subRows,
    autoResetExpanded: false,
    filterFns: { fuzzy_text, multi_select, name_recursive_fuzzy },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    meta: {
      pending_edits,
      on_begin_edit,
      on_update_edit,
      on_commit_edit,
      on_cancel_edit,
      all_ingredients: ingredients,
      selected_ids,
      on_toggle_select: toggle_select,
      on_toggle_select_all: toggle_select_all,
    },
  });

  const rows = table.getRowModel().rows;
  const selected_array = [...selected_ids];

  function apply_add_labels(): void {
    const label_names = parse_labels(bulk_add_labels);
    if (label_names.length > 0) {
      on_add_labels(selected_array, label_names);
      set_bulk_add_labels("");
    }
  }

  function apply_remove_labels(): void {
    const label_names = parse_labels(bulk_remove_labels);
    if (label_names.length > 0) {
      on_remove_labels(selected_array, label_names);
      set_bulk_remove_labels("");
    }
  }

  function apply_bulk_type(): void {
    const type = validate_type(bulk_type);
    if (type !== undefined) {
      on_bulk_set_type(selected_array, type);
      set_bulk_type("");
    }
  }

  function apply_bulk_parent(): void {
    if (bulk_parent_id === "__none__") {
      on_bulk_set_parent(selected_array, undefined);
    } else if (bulk_parent_id !== "") {
      on_bulk_set_parent(selected_array, bulk_parent_id as Ingredient.Id);
    }
    set_bulk_parent_id("");
  }

  return (
    <div className="it-wrapper" role="region" aria-label="Ingredient list">
      {selected_ids.size > 0 && (
        <div className="it-bulk-bar" role="region" aria-label="Bulk actions">
          <span className="it-bulk-count">{selected_ids.size} selected</span>
          <button
            type="button"
            className="it-bulk-clear"
            onClick={() => set_selected_ids(new Set())}
          >
            Clear
          </button>

          <span className="it-bulk-action">
            <input
              type="text"
              className="it-bulk-input"
              value={bulk_add_labels}
              onChange={(e) => set_bulk_add_labels(e.target.value)}
              placeholder="Labels to add…"
              aria-label="Labels to add"
              onKeyDown={(e) => {
                if (e.key === "Enter") apply_add_labels();
              }}
            />
            <button
              type="button"
              className="it-bulk-apply"
              disabled={bulk_add_labels.trim() === ""}
              onClick={apply_add_labels}
              aria-label="Apply add labels"
            >
              Add labels
            </button>
          </span>

          <span className="it-bulk-action">
            <input
              type="text"
              className="it-bulk-input"
              value={bulk_remove_labels}
              onChange={(e) => set_bulk_remove_labels(e.target.value)}
              placeholder="Labels to remove…"
              aria-label="Labels to remove"
              onKeyDown={(e) => {
                if (e.key === "Enter") apply_remove_labels();
              }}
            />
            <button
              type="button"
              className="it-bulk-apply"
              disabled={bulk_remove_labels.trim() === ""}
              onClick={apply_remove_labels}
              aria-label="Apply remove labels"
            >
              Remove labels
            </button>
          </span>

          <span className="it-bulk-action">
            <select
              className="it-bulk-select"
              value={bulk_type}
              onChange={(e) => set_bulk_type(e.target.value)}
              aria-label="Bulk measurement type"
            >
              <option value="">— Type —</option>
              {MEASUREMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="it-bulk-apply"
              disabled={bulk_type === ""}
              onClick={apply_bulk_type}
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
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="it-bulk-apply"
              disabled={bulk_parent_id === ""}
              onClick={apply_bulk_parent}
              aria-label="Apply parent change"
            >
              Change parent
            </button>
          </span>
        </div>
      )}

      <table className="it-table">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} className="it-th">
                  {h.isPlaceholder ||
                  h.column.id === "expand" ||
                  h.column.id === "select" ? (
                    flexRender(h.column.columnDef.header, h.getContext())
                  ) : (
                    <ColumnHeader header={h} all_labels={all_label_names} />
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS.length} className="it-empty">
                No ingredients match the current filter.
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const is_selected = !row.getIsGrouped() && selected_ids.has(row.original.id);
              return (
                <tr
                  key={row.id}
                  className={[
                    row.getIsGrouped() ? "it-row--group" : "",
                    is_selected ? "it-row--selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {row.getVisibleCells().map((cell) => {
                    if (cell.column.id === "select") {
                      return (
                        <td key={cell.id} className="it-td it-td--select">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    }
                    if (cell.column.id === "expand") {
                      return (
                        <td key={cell.id} className="it-td it-td--expand">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    }
                    if (row.getIsGrouped()) {
                      if (cell.getIsGrouped()) {
                        return (
                          <td key={cell.id} className="it-td it-td--group-value">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            <span className="it-group-count"> ({row.subRows.length})</span>
                          </td>
                        );
                      }
                      return <td key={cell.id} className="it-td" />;
                    }
                    if (grouping.length > 0 && (cell.getIsPlaceholder() || cell.getIsAggregated())) {
                      return <td key={cell.id} className="it-td" />;
                    }
                    return (
                      <td key={cell.id} className="it-td">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
