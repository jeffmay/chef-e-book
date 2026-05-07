import { useState, type FormEvent } from "react";
import type { MeasurementType } from "@recipe-book/shared";
import { use_ingredient_store } from "../hooks/use_ingredient_store.js";
import { IngredientsTable } from "../components/ingredients_table/IngredientsTable.js";
import "./BulkIngredientEditorPage.css";

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

  // --- add-ingredient form ---
  const [show_add_form, set_show_add_form] = useState(false);
  const [add_form, set_add_form] = useState<AddFormState>(EMPTY_ADD_FORM);

  function handle_add_submit(e: FormEvent) {
    e.preventDefault();
    if (add_form.name.trim() === "") return;
    const labels = add_form.labels_raw
      .split(",")
      .map((l) => l.trim())
      .filter((l) => l !== "");
    create_ingredient({
      name: add_form.name.trim(),
      default_measurement_type: add_form.measurement_type,
      labels,
      ...(add_form.parent_id !== "" && { parent_id: add_form.parent_id }),
    });
    set_add_form(EMPTY_ADD_FORM);
    set_show_add_form(false);
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

      {/* Ingredient table */}
      <IngredientsTable
        ingredients={ingredients}
        on_rename={rename_ingredient}
        on_set_type={(id, type) => set_measurement_type([id], type)}
        on_set_labels={set_labels}
        on_set_parent={(id, parent_id) => set_parent([id], parent_id)}
        on_add_labels={add_labels}
        on_remove_labels={remove_labels}
        on_bulk_set_type={set_measurement_type}
        on_bulk_set_parent={set_parent}
      />
    </main>
  );
}
