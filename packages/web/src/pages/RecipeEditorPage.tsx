import type { IngredientId } from "@recipe-book/shared";
import {
  ContainerId,
  type ContainerItem,
  EquipmentId,
  type Fraction,
  type Ingredient,
  type IngredientItem,
  type Instruction,
  type KitchenwareLabel,
  type Measurement,
  MeasurementUnit,
  type Recipe,
  RecipeFolderId,
  type RecipeIngredient,
  RecipeIngredientId,
  type RecipeVersion,
  RecipeVersionId,
  type Section,
  type SectionItem,
  SectionItemId,
  type TextBlock,
  addFractions,
  formatFraction,
  loadId,
  paddedId,
  randomId,
  unitType,
} from "@recipe-book/shared";
import { useMemo, useState } from "react";
import { DurationEditor } from "../components/duration/DurationEditor.tsx";
import { IngredientSelector } from "../components/ingredients_table/IngredientSelector.tsx";
import { MeasurementEditor } from "../components/measurement/MeasurementEditor.tsx";
import { useIngredientStore } from "../hooks/useIngredientStore.ts";
import { useLabelStore } from "../hooks/useLabelStore.ts";
import { useRecipeFolderStore } from "../hooks/useRecipeFolderStore.ts";
import { latestVersion, useRecipeStore } from "../hooks/useRecipeStore.ts";
import "./RecipeEditorPage.css";

// ---------------------------------------------------------------------------
// Helper: flatten folder tree for <select>
// ---------------------------------------------------------------------------

interface FlatFolder {
  id: RecipeFolderId;
  label: string;
}

function flattenFolders(
  folders: Array<{ id: RecipeFolderId; name: string; children?: unknown[] }>,
  depth = 0,
): FlatFolder[] {
  const result: FlatFolder[] = [];
  for (const f of folders) {
    result.push({ id: f.id, label: " ".repeat(depth * 2) + f.name });
    if (Array.isArray(f.children) && f.children.length > 0) {
      result.push(
        ...flattenFolders(
          f.children as Array<{ id: RecipeFolderId; name: string; children?: unknown[] }>,
          depth + 1,
        ),
      );
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Helper: heading level for section depth
// ---------------------------------------------------------------------------

type HeadingLevel = "h2" | "h3" | "h4" | "h5" | "h6";

function headingForDepth(depth: number): HeadingLevel {
  const levels: HeadingLevel[] = ["h2", "h3", "h4", "h5", "h6"];
  return levels[Math.min(depth - 1, levels.length - 1)] ?? "h6";
}

// ---------------------------------------------------------------------------
// Helper: collect all IngredientItems from sections (including inside containers)
// ---------------------------------------------------------------------------

function collectIngredientItems(sections: readonly Section[]): IngredientItem[] {
  const items: IngredientItem[] = [];

  function walk(contents: readonly SectionItem[]) {
    for (const item of contents) {
      if (item.kind === "ingredient") {
        items.push(item);
      } else if (item.kind === "container") {
        items.push(...item.contents);
      } else if (item.kind === "section") {
        walk(item.contents);
      }
    }
  }

  for (const section of sections) {
    walk(section.contents);
  }

  return items;
}

// ---------------------------------------------------------------------------
// Helper: compute totals per ingredient per unit from sections
// ---------------------------------------------------------------------------

interface ComputedIngredientTotal {
  ingredient_id: IngredientId;
  name: string;
  amounts: Array<{ unit: MeasurementUnit; value: Fraction }>;
}

function computeIngredientTotals(
  sections: readonly Section[],
  allIngredients: readonly Ingredient[],
): ComputedIngredientTotal[] {
  const items = collectIngredientItems(sections);
  const grouped = new Map<IngredientId, Map<MeasurementUnit, Fraction>>();

  for (const item of items) {
    if (!grouped.has(item.ingredient_id)) {
      grouped.set(item.ingredient_id, new Map());
    }
    if (item.amount !== undefined) {
      const unitMap = grouped.get(item.ingredient_id)!;
      const existing = unitMap.get(item.amount.unit);
      unitMap.set(
        item.amount.unit,
        existing !== undefined ? addFractions(existing, item.amount.value) : item.amount.value,
      );
    }
  }

  return [...grouped.entries()].map(([id, unitMap]) => {
    const ingredient = allIngredients.find((i) => i.id === id);
    return {
      ingredient_id: id,
      name: ingredient?.name ?? id,
      amounts: [...unitMap.entries()].map(([unit, value]) => ({ unit, value })),
    };
  });
}

// ---------------------------------------------------------------------------
// Helper: compute top-level RecipeIngredient[] from sections (for saving)
// ---------------------------------------------------------------------------

function computeTopIngredients(sections: readonly Section[]): RecipeIngredient[] {
  const items = collectIngredientItems(sections);
  const seen = new Set<IngredientId>();
  const result: RecipeIngredient[] = [];

  for (const item of items) {
    if (!seen.has(item.ingredient_id)) {
      seen.add(item.ingredient_id);
      result.push({
        id: randomId(RecipeIngredientId),
        ingredient_id: item.ingredient_id,
        ...(item.amount !== undefined && { amount: item.amount }),
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Unit display labels
// ---------------------------------------------------------------------------

function formatAmount(value: Fraction, unit: MeasurementUnit): string {
  return `${formatFraction(value)} ${MeasurementUnit.display[unit]}`;
}

// ---------------------------------------------------------------------------
// Default measurement
// ---------------------------------------------------------------------------

const DEFAULT_AMOUNT: Measurement = { value: { numerator: 1, denominator: 1 }, unit: "cup" };

// ---------------------------------------------------------------------------
// Exported helpers (also tested directly)
// ---------------------------------------------------------------------------

/**
 * Returns true when unitA and unitB belong to the same "measurement category":
 * - volume and weight: any unit of the same type qualifies
 * - count: unit names must match exactly because each count unit (whole, pinch,
 *   dash, or a future custom name) represents a semantically distinct category
 */
export function isSameMeasurementCategory(unitA: MeasurementUnit, unitB: MeasurementUnit): boolean {
  const typeA = unitType(unitA);
  const typeB = unitType(unitB);
  if (typeA !== typeB) return false;
  if (typeA === "count") return unitA === unitB;
  return true;
}

/**
 * Returns the amount to use after an ingredient selection change.
 * Preserves the current amount when the new ingredient is a direct child of
 * the old ingredient and shares the same measurement category; otherwise
 * resets to the new ingredient's default measurement value.
 */
export function resolveAmountOnIngredientChange(
  oldIngredientId: IngredientId | undefined,
  newIngredientId: IngredientId,
  currentAmount: Measurement,
  allIngredients: readonly Ingredient[],
): Measurement {
  const newIngredient = allIngredients.find((i) => i.id === newIngredientId);
  if (newIngredient === undefined) return currentAmount;

  if (
    oldIngredientId !== undefined &&
    newIngredient.parent_id === oldIngredientId &&
    isSameMeasurementCategory(currentAmount.unit, newIngredient.default_measurement_value.unit)
  ) {
    return currentAmount;
  }

  return newIngredient.default_measurement_value;
}

// ---------------------------------------------------------------------------
// Shared prop interfaces
// ---------------------------------------------------------------------------

interface RecipeSectionItemRowProps<T extends SectionItem = SectionItem> {
  readonly item: T;
  readonly onChange: (item: T) => void;
  readonly onRemove: () => void;
}

interface WithIngredients {
  readonly allIngredients: readonly Ingredient[];
  readonly allLabels: readonly KitchenwareLabel[];
}

// ---------------------------------------------------------------------------
// IngredientItemRow
// ---------------------------------------------------------------------------

interface IngredientItemRowProps
  extends RecipeSectionItemRowProps<IngredientItem>, WithIngredients {}

function IngredientItemRow({
  item,
  allIngredients,
  allLabels,
  onChange,
  onRemove,
}: IngredientItemRowProps) {
  const [isEditingIngredient, setIsEditingIngredient] = useState(false);
  const ingredient = allIngredients.find((i) => i.id === item.ingredient_id);
  const name = ingredient?.name ?? item.ingredient_id;
  const amountMissing = item.amount === undefined;

  function handleIngredientChange(id: IngredientId | undefined) {
    if (id !== undefined) {
      const newAmount = resolveAmountOnIngredientChange(
        item.ingredient_id,
        id,
        item.amount ?? DEFAULT_AMOUNT,
        allIngredients,
      );
      onChange({ ...item, ingredient_id: id, amount: newAmount });
    }
    setIsEditingIngredient(false);
  }

  return (
    <div
      className={`re-item re-item--ingredient${amountMissing ? " re-item--amount-required" : ""}`}
      role="group"
      aria-label={`Ingredient: ${name}`}
    >
      {isEditingIngredient ? (
        <IngredientSelector
          value={item.ingredient_id}
          options={allIngredients}
          labels={allLabels}
          onChange={handleIngredientChange}
          ariaLabel={`Change ingredient (currently ${name})`}
        />
      ) : (
        <span
          className="re-item-label"
          title="Double-click to change ingredient"
          onDoubleClick={() => setIsEditingIngredient(true)}
        >
          {name}
        </span>
      )}
      <MeasurementEditor
        value={item.amount ?? DEFAULT_AMOUNT}
        initiallyOpen={amountMissing}
        onCommit={(newAmount) => onChange({ ...item, amount: newAmount })}
      />
      {amountMissing && (
        <span className="re-item-amount-warning" role="alert" aria-label="Amount required">
          Amount required
        </span>
      )}
      <button
        type="button"
        className="re-item-remove"
        onClick={onRemove}
        aria-label={`Remove ingredient ${name}`}
      >
        −
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NewIngredientRow — draft for adding a new ingredient with required amount
// ---------------------------------------------------------------------------

interface NewIngredientRowProps extends WithIngredients {
  readonly onAdd: (item: IngredientItem) => void;
  readonly onCancel: () => void;
}

function NewIngredientRow({ allIngredients, allLabels, onAdd, onCancel }: NewIngredientRowProps) {
  const [ingredient_id, setIngredientId] = useState<IngredientId | undefined>(undefined);
  const [amount, setAmount] = useState<Measurement>(DEFAULT_AMOUNT);

  const selectedIngredient =
    ingredient_id !== undefined ? allIngredients.find((i) => i.id === ingredient_id) : undefined;

  function handleSelectIngredient(id: IngredientId | undefined) {
    if (id !== undefined) {
      setAmount(resolveAmountOnIngredientChange(ingredient_id, id, amount, allIngredients));
    }
    setIngredientId(id);
  }

  function handleAdd() {
    if (ingredient_id === undefined) return;
    onAdd({
      kind: "ingredient",
      id: randomId(SectionItemId),
      ingredient_id,
      amount,
    });
  }

  return (
    <div className="re-item re-item--new-ingredient" role="group" aria-label="New ingredient">
      <IngredientSelector
        value={ingredient_id}
        options={allIngredients}
        labels={allLabels}
        onChange={handleSelectIngredient}
        ariaLabel="Select new ingredient"
        placeholder="— Choose ingredient —"
      />
      <MeasurementEditor value={amount} onCommit={setAmount} />
      <div className="re-new-ingredient-actions">
        <button
          type="button"
          className="re-new-ingredient-add"
          onClick={handleAdd}
          disabled={ingredient_id === undefined}
          aria-label={
            selectedIngredient !== undefined
              ? `Add ${selectedIngredient.name} to section`
              : "Confirm add ingredient"
          }
        >
          Add
        </button>
        <button
          type="button"
          className="re-new-ingredient-cancel"
          onClick={onCancel}
          aria-label="Cancel adding ingredient"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContainerItemRow
// ---------------------------------------------------------------------------

const COMMON_CONTAINERS = [
  { id: paddedId(ContainerId, "bowl"), name: "Bowl" },
  { id: paddedId(ContainerId, "pot"), name: "Pot" },
  { id: paddedId(ContainerId, "steamer"), name: "Steamer" },
  { id: paddedId(ContainerId, "foil"), name: "Foil" },
  { id: paddedId(ContainerId, "pan"), name: "Pan" },
  { id: paddedId(ContainerId, "plate"), name: "Plate" },
] as const;

interface ContainerItemRowProps extends RecipeSectionItemRowProps<ContainerItem>, WithIngredients {}

function ContainerItemRow({
  item,
  allIngredients,
  allLabels,
  onChange,
  onRemove,
}: ContainerItemRowProps) {
  const [showingNewIngredient, setShowingNewIngredient] = useState(false);
  const container_name =
    COMMON_CONTAINERS.find((c) => c.id === item.container_id)?.name ?? item.container_id;

  return (
    <div
      className="re-item re-item--container"
      role="group"
      aria-label={`Container: ${container_name} — ${item.descriptor}`}
    >
      <div className="re-item-header">
        <select
          className="re-container-select"
          value={item.container_id}
          onChange={(e) =>
            onChange({ ...item, container_id: e.target.value as ContainerItem["container_id"] })
          }
          aria-label="Container type"
        >
          {COMMON_CONTAINERS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          className="re-container-descriptor"
          value={item.descriptor}
          onChange={(e) => onChange({ ...item, descriptor: e.target.value })}
          placeholder="Descriptor (e.g. large, wet ingredients)"
          aria-label="Container descriptor"
        />
        <label className="re-container-ordered">
          <input
            type="checkbox"
            checked={item.ordered ?? false}
            onChange={(e) => onChange({ ...item, ordered: e.target.checked })}
            aria-label="Ordered list"
          />
          ordered
        </label>
        <button
          type="button"
          className="re-item-remove"
          onClick={onRemove}
          aria-label={`Remove container ${container_name}`}
        >
          −
        </button>
      </div>
      <div className="re-container-contents">
        {item.contents.map((content, i) => (
          <IngredientItemRow
            key={content.id}
            item={content}
            allIngredients={allIngredients}
            allLabels={allLabels}
            onChange={(updated) => {
              const new_contents = item.contents.map((c, j) => (j === i ? updated : c));
              onChange({ ...item, contents: new_contents });
            }}
            onRemove={() =>
              onChange({ ...item, contents: item.contents.filter((_, j) => j !== i) })
            }
          />
        ))}
        {showingNewIngredient ? (
          <NewIngredientRow
            allIngredients={allIngredients}
            allLabels={allLabels}
            onAdd={(newItem) => {
              onChange({ ...item, contents: [...item.contents, newItem] });
              setShowingNewIngredient(false);
            }}
            onCancel={() => setShowingNewIngredient(false)}
          />
        ) : (
          <button
            type="button"
            className="re-container-add-ingredient-btn"
            onClick={() => setShowingNewIngredient(true)}
            aria-label={`Add ingredient to ${container_name}`}
          >
            + Add ingredient
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InstructionRow
// ---------------------------------------------------------------------------

const COMMON_EQUIPMENT = [
  { id: paddedId(EquipmentId, "oven"), name: "Oven" },
  { id: paddedId(EquipmentId, "stove"), name: "Stove" },
  { id: paddedId(EquipmentId, "mixer"), name: "Mixer" },
  { id: paddedId(EquipmentId, "blender"), name: "Blender" },
  { id: paddedId(EquipmentId, "knife"), name: "Knife" },
  { id: paddedId(EquipmentId, "skillet"), name: "Skillet" },
] as const;

interface InstructionRowProps extends RecipeSectionItemRowProps<Instruction>, WithIngredients {}

function InstructionRow({ item, allIngredients, onChange, onRemove }: InstructionRowProps) {
  function toggleIngredient(id: IngredientId) {
    const current = item.ingredient_ids ?? [];
    const exists = current.includes(id);
    const newIds = exists ? current.filter((x) => x !== id) : [...current, id];
    if (newIds.length > 0) {
      onChange({ ...item, ingredient_ids: newIds });
    } else {
      const { ingredient_ids: _, ...rest } = item;
      onChange(rest);
    }
  }

  return (
    <div
      className="re-item re-item--instruction"
      role="group"
      aria-label={`Instruction: ${item.instruction || "new"}`}
    >
      <div className="re-item-header">
        <input
          className="re-instruction-text"
          value={item.instruction}
          onChange={(e) => onChange({ ...item, instruction: e.target.value })}
          placeholder="Action (e.g. mix, bake, stir)"
          aria-label="Instruction text"
        />
        <select
          className="re-instruction-equipment"
          value={item.equipment_id ?? ""}
          onChange={(e) => {
            if (e.target.value) {
              onChange({ ...item, equipment_id: loadId(EquipmentId, e.target.value) });
            } else {
              const { equipment_id: _, ...rest } = item;
              onChange(rest);
            }
          }}
          aria-label="Equipment"
        >
          <option value="">— No equipment —</option>
          {COMMON_EQUIPMENT.map((eq) => (
            <option key={eq.id} value={eq.id}>
              {eq.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="re-item-remove"
          onClick={onRemove}
          aria-label="Remove instruction"
        >
          −
        </button>
      </div>

      <div className="re-instruction-duration">
        <label className="re-instruction-duration-label">
          Duration:
          {item.duration_seconds !== undefined ? (
            <DurationEditor
              value={item.duration_seconds}
              onCommit={(s) => onChange({ ...item, duration_seconds: s })}
            />
          ) : (
            <button
              type="button"
              className="re-instruction-add-duration"
              onClick={() => onChange({ ...item, duration_seconds: 300 })}
            >
              + Add duration
            </button>
          )}
        </label>
        {item.duration_seconds !== undefined && (
          <button
            type="button"
            className="re-instruction-remove-duration"
            onClick={() => {
              const { duration_seconds: _, ...rest } = item;
              onChange(rest);
            }}
            aria-label="Remove duration"
          >
            ×
          </button>
        )}
      </div>

      <div className="re-instruction-ingredients">
        <span className="re-instruction-ing-label">Ingredients:</span>
        {allIngredients.map((ing) => {
          const checked = (item.ingredient_ids ?? []).includes(ing.id);
          return (
            <label key={ing.id} className="re-instruction-ing-option">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleIngredient(ing.id)}
                aria-label={ing.name}
              />
              {ing.name}
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TextBlockRow
// ---------------------------------------------------------------------------

type TextBlockRowProps = RecipeSectionItemRowProps<TextBlock>;

function TextBlockRow({ item, onChange, onRemove }: TextBlockRowProps) {
  return (
    <div className="re-item re-item--text-block" role="group" aria-label="Text block">
      <textarea
        className="re-text-block-input"
        value={item.text}
        onChange={(e) => onChange({ ...item, text: e.target.value })}
        placeholder="Enter text…"
        aria-label="Text block content"
        rows={3}
      />
      <button
        type="button"
        className="re-item-remove"
        onClick={onRemove}
        aria-label="Remove text block"
      >
        −
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionEditor (recursive)
// ---------------------------------------------------------------------------

type NewItemKind = "ingredient" | "container" | "instruction" | "text_block" | "section";

interface SectionEditorProps extends RecipeSectionItemRowProps<Section>, WithIngredients {
  readonly depth: number;
}

function SectionEditor({
  item: section,
  depth,
  allIngredients,
  allLabels,
  onChange,
  onRemove,
}: SectionEditorProps) {
  const [showingNewIngredient, setShowingNewIngredient] = useState(false);
  const Heading = headingForDepth(depth);

  function updateItem(index: number, updated: SectionItem) {
    const new_contents = section.contents.map((item, i) => (i === index ? updated : item));
    onChange({ ...section, contents: new_contents });
  }

  function removeItem(index: number) {
    onChange({ ...section, contents: section.contents.filter((_, i) => i !== index) });
  }

  function addItem(kind: NewItemKind) {
    if (kind === "ingredient") {
      setShowingNewIngredient(true);
      return;
    }
    const new_id = randomId(SectionItemId);
    let new_item: SectionItem;
    if (kind === "container") {
      new_item = {
        kind: "container",
        id: new_id,
        container_id: COMMON_CONTAINERS[0].id,
        descriptor: "",
        contents: [],
      };
    } else if (kind === "instruction") {
      new_item = { kind: "instruction", id: new_id, instruction: "" };
    } else if (kind === "text_block") {
      new_item = { kind: "text_block", id: new_id, text: "" };
    } else {
      if (depth >= 5) return;
      new_item = { kind: "section", id: new_id, contents: [] };
    }
    onChange({ ...section, contents: [...section.contents, new_item] });
  }

  return (
    <div
      role="group"
      className={`re-section re-section--depth-${depth}`}
      aria-label={`Section: ${section.header ?? "unnamed"}`}
    >
      <div className="re-section-header-row">
        <Heading className="re-section-heading">
          <input
            className="re-section-header-input"
            value={section.header ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              if (val) {
                onChange({ ...section, header: val });
              } else {
                const { header: _, ...rest } = section;
                onChange(rest as Section);
              }
            }}
            placeholder="Section header (optional)"
            aria-label="Section header"
          />
        </Heading>
        <button
          type="button"
          className="re-item-remove"
          onClick={onRemove}
          aria-label="Remove section"
        >
          −
        </button>
      </div>

      <div className="re-section-contents">
        {section.contents.map((item, i) => {
          if (item.kind === "ingredient") {
            return (
              <IngredientItemRow
                key={item.id}
                item={item}
                allIngredients={allIngredients}
                allLabels={allLabels}
                onChange={(updated) => updateItem(i, updated)}
                onRemove={() => removeItem(i)}
              />
            );
          }
          if (item.kind === "container") {
            return (
              <ContainerItemRow
                key={item.id}
                item={item}
                allIngredients={allIngredients}
                allLabels={allLabels}
                onChange={(updated) => updateItem(i, updated)}
                onRemove={() => removeItem(i)}
              />
            );
          }
          if (item.kind === "instruction") {
            return (
              <InstructionRow
                key={item.id}
                item={item}
                allIngredients={allIngredients}
                allLabels={allLabels}
                onChange={(updated) => updateItem(i, updated)}
                onRemove={() => removeItem(i)}
              />
            );
          }
          if (item.kind === "text_block") {
            return (
              <TextBlockRow
                key={item.id}
                item={item}
                onChange={(updated) => updateItem(i, updated)}
                onRemove={() => removeItem(i)}
              />
            );
          }
          if (item.kind === "section" && depth < 5) {
            return (
              <SectionEditor
                key={item.id}
                item={item}
                depth={depth + 1}
                allIngredients={allIngredients}
                allLabels={allLabels}
                onChange={(updated) => updateItem(i, updated)}
                onRemove={() => removeItem(i)}
              />
            );
          }
          return null;
        })}
        {showingNewIngredient && (
          <NewIngredientRow
            allIngredients={allIngredients}
            allLabels={allLabels}
            onAdd={(newItem) => {
              onChange({ ...section, contents: [...section.contents, newItem] });
              setShowingNewIngredient(false);
            }}
            onCancel={() => setShowingNewIngredient(false)}
          />
        )}
      </div>

      <div className="re-section-add-row">
        <span className="re-section-add-label">Add:</span>
        <button
          type="button"
          onClick={() => addItem("ingredient")}
          aria-label="Add ingredient to section"
        >
          Ingredient
        </button>
        <button
          type="button"
          onClick={() => addItem("container")}
          aria-label="Add container to section"
        >
          Container
        </button>
        <button
          type="button"
          onClick={() => addItem("instruction")}
          aria-label="Add instruction to section"
        >
          Instruction
        </button>
        <button
          type="button"
          onClick={() => addItem("text_block")}
          aria-label="Add text block to section"
        >
          Text
        </button>
        {depth < 5 && (
          <button type="button" onClick={() => addItem("section")} aria-label="Add sub-section">
            Sub-section
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RecipeIngredientsDisplay — computed read-only list derived from sections
// ---------------------------------------------------------------------------

interface RecipeIngredientsDisplayProps {
  readonly sections: readonly Section[];
  readonly allIngredients: readonly Ingredient[];
}

function RecipeIngredientsDisplay({ sections, allIngredients }: RecipeIngredientsDisplayProps) {
  const totals = useMemo(
    () => computeIngredientTotals(sections, allIngredients),
    [sections, allIngredients],
  );

  return (
    <section className="re-section-block" aria-label="Ingredients">
      <h2 className="re-section-title">Ingredients</h2>
      {totals.length === 0 ? (
        <p className="re-ing-empty">Add ingredients to sections to see them listed here.</p>
      ) : (
        <div className="re-ing-list">
          {totals.map((total) => (
            <div
              key={total.ingredient_id}
              className="re-ing-row"
              aria-label={`Ingredient: ${total.name}`}
            >
              <span className="re-ing-name">{total.name}</span>
              <span className="re-ing-amounts">
                {total.amounts.length > 0 ? (
                  total.amounts.map(({ unit, value }) => formatAmount(value, unit)).join(", ")
                ) : (
                  <em className="re-ing-no-amount">no amount</em>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// VersionHistoryTable
// ---------------------------------------------------------------------------

interface VersionHistoryTableProps {
  readonly versions: RecipeVersion[];
}

function VersionHistoryTable({ versions }: VersionHistoryTableProps) {
  const [open, setOpen] = useState(false);
  const sorted = [...versions].reverse();

  return (
    <details
      className="re-version-history"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="re-version-history-summary">Version history ({versions.length})</summary>
      <div className="re-version-history-body">
        <table className="re-version-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((v) => (
              <tr key={v.id}>
                <td>{new Date(v.created_at).toLocaleDateString()}</td>
                <td>{v.description || <em>—</em>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// CopyRecipeDialog
// ---------------------------------------------------------------------------

interface CopyRecipeDialogProps {
  readonly recipe: Recipe;
  readonly flatFolders: Array<{ id: RecipeFolderId; label: string }>;
  readonly onCopy: (title: string, folder_id: RecipeFolderId | undefined) => void;
  readonly onCancel: () => void;
}

function CopyRecipeDialog({ recipe, flatFolders, onCopy, onCancel }: CopyRecipeDialogProps) {
  const [title, setTitle] = useState(`${recipe.title} (copy)`);
  const [folder_id, setFolderId] = useState<RecipeFolderId | undefined>(recipe.parent_folder_id);

  return (
    <div className="re-dialog-overlay" role="dialog" aria-modal="true" aria-label="Copy recipe">
      <div className="re-dialog">
        <h2 className="re-dialog-title">Copy Recipe</h2>
        <label className="re-field-label">
          New title
          <input
            className="re-field-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="New recipe title"
          />
        </label>
        <label className="re-field-label">
          Parent folder
          <select
            className="re-field-select"
            value={folder_id ?? ""}
            onChange={(e) =>
              setFolderId(e.target.value ? loadId(RecipeFolderId, e.target.value) : undefined)
            }
            aria-label="Parent folder for copy"
          >
            <option value="">— None —</option>
            {flatFolders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <div className="re-dialog-actions">
          <button
            type="button"
            onClick={() => onCopy(title, folder_id)}
            disabled={title.trim() === ""}
          >
            Copy
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditorState
// ---------------------------------------------------------------------------

interface EditorState {
  title: string;
  subtitle: string;
  source_url: string;
  parent_folder_id: RecipeFolderId | undefined;
  description: string;
  sections: Section[];
  create_new_version: boolean;
}

function makeInitialState(
  recipe: Recipe | null,
  versionId?: string,
  initialFolderId?: RecipeFolderId,
): EditorState {
  if (recipe === null) {
    return {
      title: "",
      subtitle: "",
      source_url: "",
      parent_folder_id: initialFolderId,
      description: "",
      sections: [],
      create_new_version: false,
    };
  }
  const v =
    versionId !== undefined
      ? (recipe.versions.find((ver) => ver.id === versionId) ?? latestVersion(recipe))
      : latestVersion(recipe);
  return {
    title: recipe.title,
    subtitle: recipe.subtitle ?? "",
    source_url: recipe.source_url ?? "",
    parent_folder_id: recipe.parent_folder_id,
    description: v?.description ?? "",
    sections: v?.sections ?? [],
    create_new_version: false,
  };
}

// ---------------------------------------------------------------------------
// RecipeEditor
// ---------------------------------------------------------------------------

export interface RecipeEditorProps {
  readonly recipe: Recipe | null;
  readonly versionId?: string;
  readonly initialFolderId?: RecipeFolderId;
  readonly onSave: (recipe: Recipe) => void;
  readonly onCancel: () => void;
}

export function RecipeEditor({
  recipe,
  versionId,
  initialFolderId,
  onSave,
  onCancel,
}: RecipeEditorProps) {
  const { create, save, copy } = useRecipeStore();
  const { flatFolders, folders } = useRecipeFolderStore();
  const { ingredients } = useIngredientStore();
  const { labels } = useLabelStore();
  const [form, setForm] = useState<EditorState>(() =>
    makeInitialState(recipe, versionId, initialFolderId),
  );
  const [showCopyDialog, setShowCopyDialog] = useState(false);

  const flat = flattenFolders(folders);

  function patch<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSave() {
    const computedIngredients = computeTopIngredients(form.sections);

    if (recipe === null) {
      const created = create({
        title: form.title,
        ...(form.subtitle && { subtitle: form.subtitle }),
        ...(form.source_url && { source_url: form.source_url }),
        ...(form.parent_folder_id !== undefined && { parent_folder_id: form.parent_folder_id }),
        description: form.description,
      });
      onSave(created);
    } else {
      const v = latestVersion(recipe);
      const version: RecipeVersion = {
        id: v?.id ?? randomId(RecipeVersionId),
        recipe_id: recipe.id,
        description: form.description,
        ingredients: computedIngredients,
        sections: form.sections,
        created_at: v?.created_at ?? Date.now(),
      };
      const updated = save(recipe.id, {
        title: form.title,
        ...(form.subtitle && { subtitle: form.subtitle }),
        ...(form.source_url && { source_url: form.source_url }),
        ...(form.parent_folder_id !== undefined && { parent_folder_id: form.parent_folder_id }),
        version,
        create_new_version: form.create_new_version,
      });
      onSave(updated);
    }
  }

  function handleCopy(title: string, folder_id: RecipeFolderId | undefined) {
    if (recipe === null) return;
    const copied = copy(recipe.id, title, folder_id);
    setShowCopyDialog(false);
    onSave(copied);
  }

  const createNewVersion = !recipe || form.create_new_version;

  const missingAmountCount = useMemo(
    () => collectIngredientItems(form.sections).filter((i) => i.amount === undefined).length,
    [form.sections],
  );
  const descriptionError =
    form.description.trim() === "" ? "Version description is required" : null;
  const canSave = form.title.trim() !== "" && descriptionError === null && missingAmountCount === 0;

  return (
    <main className="re-editor" aria-label="Recipe editor">
      <div className="re-editor-header">
        <button
          type="button"
          className="re-back-btn"
          onClick={onCancel}
          aria-label="Back to recipe list"
        >
          ← Back
        </button>
        <h1 className="re-editor-title">{recipe ? `Edit: ${recipe.title}` : "New Recipe"}</h1>
        {recipe && (
          <button type="button" className="re-copy-btn" onClick={() => setShowCopyDialog(true)}>
            Copy recipe
          </button>
        )}
      </div>

      {/* Recipe info */}
      <section className="re-section-block" aria-label="Recipe info">
        <h2 className="re-section-title">Recipe Info</h2>

        <label className="re-field-label">
          Title
          <input
            className="re-field-input re-field-input--title"
            value={form.title}
            onChange={(e) => patch("title", e.target.value)}
            placeholder="Recipe title"
            aria-label="Recipe title"
            required
          />
        </label>

        <label className="re-field-label">
          Subtitle
          <input
            className="re-field-input"
            value={form.subtitle}
            onChange={(e) => patch("subtitle", e.target.value)}
            placeholder="Subtitle"
            aria-label="Recipe subtitle"
          />
        </label>

        <label className="re-field-label">
          Source URL
          <input
            className="re-field-input"
            type="url"
            value={form.source_url}
            onChange={(e) => patch("source_url", e.target.value)}
            placeholder="https://..."
            aria-label="Source URL"
          />
        </label>

        <label className="re-field-label">
          Folder
          <select
            className="re-field-select"
            value={form.parent_folder_id ?? ""}
            onChange={(e) =>
              patch(
                "parent_folder_id",
                e.target.value ? loadId(RecipeFolderId, e.target.value) : undefined,
              )
            }
            aria-label="Parent folder"
          >
            <option value="">— None —</option>
            {flat.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {/* Computed ingredients list */}
      <RecipeIngredientsDisplay sections={form.sections} allIngredients={ingredients} />

      {/* Instruction sections */}
      <section className="re-section-block" aria-label="Instructions">
        <h2 className="re-section-title">Instructions</h2>
        {form.sections.map((sec, i) => (
          <SectionEditor
            key={sec.id}
            item={sec}
            depth={1}
            allIngredients={ingredients}
            allLabels={labels}
            onChange={(updated) =>
              patch(
                "sections",
                form.sections.map((s, j) => (j === i ? updated : s)),
              )
            }
            onRemove={() =>
              patch(
                "sections",
                form.sections.filter((_, j) => j !== i),
              )
            }
          />
        ))}
        <button
          type="button"
          className="re-add-section-btn"
          onClick={() => {
            const new_section: Section = {
              kind: "section",
              id: randomId(SectionItemId),
              contents: [],
            };
            patch("sections", [...form.sections, new_section]);
          }}
          aria-label="Add section"
        >
          + Add section
        </button>
      </section>

      {/* Version history */}
      {recipe && <VersionHistoryTable versions={recipe.versions} />}

      {/* Save actions */}
      <section className="re-actions">
        <div className="re-version-options">
          <label className="re-new-version-label">
            <input
              type="checkbox"
              checked={createNewVersion}
              disabled={!recipe}
              onChange={(e) => patch("create_new_version", e.target.checked)}
              aria-label="Create a new version from changes"
            />
            Create new version
          </label>
          <div className="re-version-description">
            <input
              className={`re-new-version-input${descriptionError !== null ? " re-field-input--error" : ""}`}
              value={form.description}
              onChange={(e) => patch("description", e.target.value)}
              placeholder='ex: "Untested" or "Final Version"'
              aria-label="Version description"
              aria-describedby={descriptionError !== null ? "re-description-error" : undefined}
            />
            {descriptionError !== null && (
              <span id="re-description-error" className="re-field-error" role="alert">
                {descriptionError}
              </span>
            )}
          </div>
        </div>
        {missingAmountCount > 0 && (
          <p className="re-validation-error" role="alert">
            {missingAmountCount} ingredient{missingAmountCount !== 1 ? "s are" : " is"} missing an
            amount. Set all amounts or remove the ingredient.
          </p>
        )}
        <div className="re-save-actions" aria-label="Save actions">
          <button type="button" className="re-cancel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="re-save-btn"
            onClick={handleSave}
            disabled={!canSave}
            aria-label="Save recipe"
          >
            Save updates
          </button>
        </div>
      </section>

      {/* Copy dialog */}
      {showCopyDialog && recipe && (
        <CopyRecipeDialog
          recipe={recipe}
          flatFolders={flatFolders.map((f) => ({ id: f.id, label: f.name }))}
          onCopy={handleCopy}
          onCancel={() => setShowCopyDialog(false)}
        />
      )}
    </main>
  );
}
