import { findOrCreateLabel, IngredientId, KitchenwareKind, KitchenwareLabelId, type Measurement } from "@recipe-book/shared";
import { useState } from "react";
import { MeasurementEditor } from "../components/measurement/MeasurementEditor.js";
import { IngredientsTable, type ExternalLabelFilter } from "../components/ingredients_table/IngredientsTable.js";
import { LabelTable } from "../components/ingredients_table/LabelTable.js";
import { useDoc } from "../contexts/doc_context.js";
import { useIngredientStore } from "../hooks/use_ingredient_store.js";
import { useLabelStore } from "../hooks/use_label_store.js";
import "./BulkIngredientEditorPage.css";

const INGREDIENT_KINDS: ReadonlySet<KitchenwareKind> = new Set(["ingredient"]);

// ---------------------------------------------------------------------------
// Add-ingredient form state
// ---------------------------------------------------------------------------

const DEFAULT_MEASUREMENT: Measurement = { value: { numerator: 1, denominator: 1 }, unit: "cup" };

interface AddFormState {
  name: string;
  measurement_value: Measurement;
  labels_raw: string;
  parent_id: string;
}

const EMPTY_ADD_FORM: AddFormState = {
  name: "",
  measurement_value: DEFAULT_MEASUREMENT,
  labels_raw: "",
  parent_id: "",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BulkIngredientEditorPage() {
  const doc = useDoc();

  const {
    ingredients,
    create_ingredient,
    renameIngredient,
    add_labels,
    remove_labels,
    set_labels,
    set_measurement_value,
    set_parent,
  } = useIngredientStore();

  const { labels, renameLabel, deleteLabels, merge_labels } = useLabelStore();

  const [show_add_form, set_show_add_form] = useState(false);
  const [add_form, set_add_form] = useState<AddFormState>(EMPTY_ADD_FORM);
  const [external_label_filter, set_external_label_filter] = useState<
    ExternalLabelFilter | undefined
  >(undefined);

  function resolveLabelNames(label_names: readonly string[]): readonly KitchenwareLabelId[] {
    return label_names.map((name) => findOrCreateLabel(doc, name, INGREDIENT_KINDS));
  }

  function handleAddSubmit(e: { preventDefault(): void }): void {
    e.preventDefault();
    // TODO: Validate parent_id
    const valid_parent_id = add_form.parent_id as IngredientId;
    // assertValid(valid_parent_id, { message: "Invalid parent ingredient ID" });
    const label_name = add_form.name.trim();
    if (label_name === "") return;
    const label_names = add_form.labels_raw
      .split(",")
      .map((l) => l.trim())
      .filter((l) => l !== "");
    create_ingredient({
      name: label_name,
      default_measurement_value: add_form.measurement_value,
      label_names,
      ...(add_form.parent_id && {
        parent_id: valid_parent_id,
      }),
    });
    set_add_form(EMPTY_ADD_FORM);
    set_show_add_form(false);
  }

  function handleSetLabels(id: IngredientId, label_names: readonly string[]): void {
    set_labels(id, resolveLabelNames(label_names));
  }

  function handleAddLabels(
    ids: readonly IngredientId[],
    label_names: readonly string[],
  ): void {
    add_labels(ids, resolveLabelNames(label_names));
  }

  function handleRemoveLabels(
    ids: readonly IngredientId[],
    label_names: readonly string[],
  ): void {
    const remove_ids = label_names
      .map((name) => labels.find((l) => l.name === name)?.id)
      .filter((id) => id !== undefined);
    if (remove_ids.length > 0) {
      remove_labels(ids, remove_ids);
    }
  }

  function handleSetParent(
    id: IngredientId,
    parent_id: IngredientId | undefined,
  ): void {
    set_parent([id], parent_id);
  }

  function handleFilterAll(label_ids: readonly KitchenwareLabelId[]): void {
    if (label_ids.length === 0) {
      set_external_label_filter(undefined);
    } else {
      set_external_label_filter({ label_ids, mode: "all" });
    }
  }

  function handleFilterAny(label_ids: readonly KitchenwareLabelId[]): void {
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
        <form className="bie-add-form" onSubmit={handleAddSubmit} aria-label="Add ingredient">
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
            Default measurement
            <MeasurementEditor
              value={add_form.measurement_value}
              onCommit={(value) => set_add_form((f) => ({ ...f, measurement_value: value }))}
            />
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
        onFilterAll={handleFilterAll}
        onFilterAny={handleFilterAny}
        onDelete={(ids) => deleteLabels([...ids])}
        onMerge={merge_labels}
        onRename={renameLabel}
      />

      {/* Ingredient table */}
      <IngredientsTable
        ingredients={ingredients}
        labels={labels}
        {...(external_label_filter !== undefined && { external_label_filter })}
        onRename={renameIngredient}
        onSetMeasurementValue={(id, value) => set_measurement_value([id], value)}
        onSetLabels={handleSetLabels}
        onSetParent={handleSetParent}
        onAddLabels={handleAddLabels}
        onRemoveLabels={handleRemoveLabels}
        onBulkSetMeasurementValue={set_measurement_value}
        onBulkSetParent={set_parent}
      />
    </main>
  );
}
