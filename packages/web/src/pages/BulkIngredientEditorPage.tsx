import { findOrCreateLabel, IngredientId, KitchenwareKind, KitchenwareLabelId, type Measurement } from "@recipe-book/shared";
import { useState } from "react";
import { MeasurementEditor } from "../components/measurement/MeasurementEditor.js";
import { IngredientsTable, type ExternalLabelFilter } from "../components/ingredients_table/IngredientsTable.js";
import { LabelTable } from "../components/ingredients_table/LabelTable.js";
import { useDoc } from "../contexts/docContext.js";
import { useIngredientStore } from "../hooks/useIngredientStore.js";
import { useLabelStore } from "../hooks/useLabelStore.js";
import "./BulkIngredientEditorPage.css";

const ingredientKinds: ReadonlySet<KitchenwareKind> = new Set(["ingredient"]);

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
    createIngredient,
    renameIngredient,
    addLabels,
    removeLabels,
    setLabels,
    setMeasurementValue,
    setParent,
  } = useIngredientStore();

  const { labels, renameLabel, deleteLabels, mergeLabels } = useLabelStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<AddFormState>(EMPTY_ADD_FORM);
  const [externalLabelFilter, setExternalLabelFilter] = useState<
    ExternalLabelFilter | undefined
  >(undefined);

  function resolveLabelNames(labelNames: readonly string[]): readonly KitchenwareLabelId[] {
    return labelNames.map((name) => findOrCreateLabel(doc, name, ingredientKinds));
  }

  function handleAddSubmit(e: { preventDefault(): void }): void {
    e.preventDefault();
    // TODO: Validate parent_id
    const validParentId = addForm.parent_id as IngredientId;
    // assertValid(validParentId, { message: "Invalid parent ingredient ID" });
    const labelName = addForm.name.trim();
    if (labelName === "") return;
    const labelNames = addForm.labels_raw
      .split(",")
      .map((l) => l.trim())
      .filter((l) => l !== "");
    createIngredient({
      name: labelName,
      default_measurement_value: addForm.measurement_value,
      labelNames,
      ...(addForm.parent_id && {
        parent_id: validParentId,
      }),
    });
    setAddForm(EMPTY_ADD_FORM);
    setShowAddForm(false);
  }

  function handleSetLabels(id: IngredientId, labelNames: readonly string[]): void {
    setLabels(id, resolveLabelNames(labelNames));
  }

  function handleAddLabels(
    ids: readonly IngredientId[],
    labelNames: readonly string[],
  ): void {
    addLabels(ids, resolveLabelNames(labelNames));
  }

  function handleRemoveLabels(
    ids: readonly IngredientId[],
    labelNames: readonly string[],
  ): void {
    const remove_ids = labelNames
      .map((name) => labels.find((l) => l.name === name)?.id)
      .filter((id) => id !== undefined);
    if (remove_ids.length > 0) {
      removeLabels(ids, remove_ids);
    }
  }

  function handleSetParent(
    id: IngredientId,
    parent_id: IngredientId | undefined,
  ): void {
    setParent([id], parent_id);
  }

  function handleFilterAll(label_ids: readonly KitchenwareLabelId[]): void {
    if (label_ids.length === 0) {
      setExternalLabelFilter(undefined);
    } else {
      setExternalLabelFilter({ label_ids, mode: "all" });
    }
  }

  function handleFilterAny(label_ids: readonly KitchenwareLabelId[]): void {
    if (label_ids.length === 0) {
      setExternalLabelFilter(undefined);
    } else {
      setExternalLabelFilter({ label_ids, mode: "any" });
    }
  }

  return (
    <main className="bie-page">
      <h1 className="bie-title">Ingredients</h1>

      {/* Add ingredient form */}
      {showAddForm && (
        <form className="bie-addForm" onSubmit={handleAddSubmit} aria-label="Add ingredient">
          <h2 className="bie-add-title">New Ingredient</h2>
          <label className="bie-add-label">
            Name
            <input
              className="bie-add-input"
              type="text"
              value={addForm.name}
              onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              required
              aria-label="New ingredient name"
              autoFocus
            />
          </label>
          <label className="bie-add-label">
            Default measurement
            <MeasurementEditor
              value={addForm.measurement_value}
              onCommit={(value) => setAddForm((f) => ({ ...f, measurement_value: value }))}
            />
          </label>
          <label className="bie-add-label">
            Labels (comma-separated)
            <input
              className="bie-add-input"
              type="text"
              value={addForm.labels_raw}
              onChange={(e) => setAddForm((f) => ({ ...f, labels_raw: e.target.value }))}
              placeholder="e.g. solid, fat"
              aria-label="New ingredient labels"
            />
          </label>
          <label className="bie-add-label">
            Parent ingredient
            <select
              className="bie-add-select"
              value={addForm.parent_id}
              onChange={(e) => setAddForm((f) => ({ ...f, parent_id: e.target.value }))}
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
            <button type="submit" disabled={addForm.name.trim() === ""}>
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setAddForm(EMPTY_ADD_FORM);
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
          onClick={() => setShowAddForm((v) => !v)}
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
        onMerge={mergeLabels}
        onRename={renameLabel}
      />

      {/* Ingredient table */}
      <IngredientsTable
        ingredients={ingredients}
        labels={labels}
        {...(externalLabelFilter !== undefined && { externalLabelFilter })}
        onRename={renameIngredient}
        onSetMeasurementValue={(id, value) => setMeasurementValue([id], value)}
        onSetLabels={handleSetLabels}
        onSetParent={handleSetParent}
        onAddLabels={handleAddLabels}
        onRemoveLabels={handleRemoveLabels}
        onBulkSetMeasurementValue={setMeasurementValue}
        onBulkSetParent={setParent}
      />
    </main>
  );
}
