import { useState } from "react";
import type { MeasurementType, Ingredient, ItemLabel, ItemKind } from "@recipe-book/shared";
import { find_or_create_label } from "@recipe-book/shared";
import { use_ingredient_store } from "../hooks/use_ingredient_store.js";
import { use_label_store } from "../hooks/use_label_store.js";
import { use_doc } from "../contexts/doc_context.js";
import { IngredientsTable, type ExternalLabelFilter } from "../components/ingredients_table/IngredientsTable.js";
import { LabelTable } from "../components/ingredients_table/LabelTable.js";
import "./BulkIngredientEditorPage.css";

const INGREDIENT_KINDS: ReadonlySet<ItemKind> = new Set(["ingredient"]);

// ---------------------------------------------------------------------------
// Add-ingredient form state
// ---------------------------------------------------------------------------

interface AddFormState {
  name: string;
  measurement_type: MeasurementType;
  labels_raw: string;
  parent_id: string;
}

const EMPTY_ADD_FORM: AddFormState = {
  name: "",
  measurement_type: "volume",
  labels_raw: "",
  parent_id: "",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BulkIngredientEditorPage() {
  const doc = use_doc();

  const {
    ingredients,
    create_ingredient,
    rename_ingredient,
    add_labels,
    remove_labels,
    set_labels,
    set_measurement_type,
    set_parent,
  } = use_ingredient_store();

  const { labels, rename_label, delete_labels, merge_labels } = use_label_store();

  const [show_add_form, set_show_add_form] = useState(false);
  const [add_form, set_add_form] = useState<AddFormState>(EMPTY_ADD_FORM);
  const [external_label_filter, set_external_label_filter] = useState<
    ExternalLabelFilter | undefined
  >(undefined);

  function resolve_label_names(label_names: readonly string[]): readonly ItemLabel.Id[] {
    return label_names.map((name) => find_or_create_label(doc, name, INGREDIENT_KINDS));
  }

  function handle_add_submit(e: { preventDefault(): void }): void {
    e.preventDefault();
    if (add_form.name.trim() === "") return;
    const label_names = add_form.labels_raw
      .split(",")
      .map((l) => l.trim())
      .filter((l) => l !== "");
    create_ingredient({
      name: add_form.name.trim(),
      default_measurement_type: add_form.measurement_type,
      label_names,
      ...(add_form.parent_id !== "" && {
        parent_id: add_form.parent_id as Ingredient.Id,
      }),
    });
    set_add_form(EMPTY_ADD_FORM);
    set_show_add_form(false);
  }

  function handle_set_labels(id: Ingredient.Id, label_names: readonly string[]): void {
    set_labels(id, resolve_label_names(label_names));
  }

  function handle_add_labels(
    ids: readonly Ingredient.Id[],
    label_names: readonly string[],
  ): void {
    add_labels(ids, resolve_label_names(label_names));
  }

  function handle_remove_labels(
    ids: readonly Ingredient.Id[],
    label_names: readonly string[],
  ): void {
    const remove_ids = label_names
      .map((name) => labels.find((l) => l.name === name)?.id)
      .filter((id): id is ItemLabel.Id => id !== undefined);
    if (remove_ids.length > 0) {
      remove_labels(ids, remove_ids);
    }
  }

  function handle_set_parent(
    id: Ingredient.Id,
    parent_id: Ingredient.Id | undefined,
  ): void {
    set_parent([id], parent_id);
  }

  function handle_filter_all(label_ids: readonly ItemLabel.Id[]): void {
    if (label_ids.length === 0) {
      set_external_label_filter(undefined);
    } else {
      set_external_label_filter({ label_ids, mode: "all" });
    }
  }

  function handle_filter_any(label_ids: readonly ItemLabel.Id[]): void {
    if (label_ids.length === 0) {
      set_external_label_filter(undefined);
    } else {
      set_external_label_filter({ label_ids, mode: "any" });
    }
  }

  return (
    <main className="bie-page">
      <h1 className="bie-title">Ingredients</h1>

      {/* Add ingredient form */}
      {show_add_form && (
        <form className="bie-add-form" onSubmit={handle_add_submit} aria-label="Add ingredient">
          <h2 className="bie-add-title">New Ingredient</h2>
          <label className="bie-add-label">
            Name
            <input
              className="bie-add-input"
              type="text"
              value={add_form.name}
              onChange={(e) => set_add_form((f) => ({ ...f, name: e.target.value }))}
              required
              aria-label="New ingredient name"
              autoFocus
            />
          </label>
          <label className="bie-add-label">
            Default measurement type
            <select
              className="bie-add-select"
              value={add_form.measurement_type}
              onChange={(e) =>
                set_add_form((f) => ({
                  ...f,
                  measurement_type: e.target.value as MeasurementType,
                }))
              }
              aria-label="New ingredient measurement type"
            >
              <option value="volume">Volume</option>
              <option value="weight">Weight</option>
              <option value="count">Count</option>
            </select>
          </label>
          <label className="bie-add-label">
            Labels (comma-separated)
            <input
              className="bie-add-input"
              type="text"
              value={add_form.labels_raw}
              onChange={(e) => set_add_form((f) => ({ ...f, labels_raw: e.target.value }))}
              placeholder="e.g. solid, fat"
              aria-label="New ingredient labels"
            />
          </label>
          <label className="bie-add-label">
            Parent ingredient
            <select
              className="bie-add-select"
              value={add_form.parent_id}
              onChange={(e) => set_add_form((f) => ({ ...f, parent_id: e.target.value }))}
              aria-label="New ingredient parent"
            >
              <option value="">— None —</option>
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <div className="bie-add-actions">
            <button type="submit" disabled={add_form.name.trim() === ""}>
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                set_show_add_form(false);
                set_add_form(EMPTY_ADD_FORM);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Actions bar */}
      <div className="bie-actions">
        <button
          className="bie-add-btn"
          onClick={() => set_show_add_form((v) => !v)}
          aria-label="Add new ingredient"
        >
          + New ingredient
        </button>
      </div>

      {/* Label table (expandable) */}
      <LabelTable
        labels={labels}
        on_filter_all={handle_filter_all}
        on_filter_any={handle_filter_any}
        on_delete={(ids) => delete_labels([...ids])}
        on_merge={merge_labels}
        on_rename={rename_label}
      />

      {/* Ingredient table */}
      <IngredientsTable
        ingredients={ingredients}
        labels={labels}
        {...(external_label_filter !== undefined && { external_label_filter })}
        on_rename={rename_ingredient}
        on_set_type={(id, type) => set_measurement_type([id], type)}
        on_set_labels={handle_set_labels}
        on_set_parent={handle_set_parent}
        on_add_labels={handle_add_labels}
        on_remove_labels={handle_remove_labels}
        on_bulk_set_type={set_measurement_type}
        on_bulk_set_parent={set_parent}
      />
    </main>
  );
}
