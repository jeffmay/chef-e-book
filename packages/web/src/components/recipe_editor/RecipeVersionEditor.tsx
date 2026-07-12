import type { AnyCompanion, IngredientId, KitchenwareLabel } from "@recipe-book/shared";
import {
  addFractions,
  assertDefined,
  collectIngredientItems,
  type ContainerItem,
  EquipmentId,
  formatFraction,
  type Fraction,
  Ingredient,
  type IngredientItem,
  type Instruction,
  loadId,
  type Measurement,
  MeasurementUnit,
  fixedId,
  randomId,
  removeSectionItemsById,
  type Section,
  type SectionItem,
  SectionItemId,
  type TextBlock,
  unitType,
} from "@recipe-book/shared";
import type { TreeNode } from "primereact/treenode";
import { useMemo, useRef, useState } from "react";
import type { ReadonlyDeep } from "type-fest";
import { useIngredientStore } from "../../hooks/useIngredientStore.ts";
import { useLabelStore } from "../../hooks/useLabelStore.ts";
import { DurationEditor } from "../duration/DurationEditor.tsx";
import { IngredientSelector } from "../ingredients_table/IngredientSelector.tsx";
import { MeasurementEditor } from "../measurement/MeasurementEditor.tsx";
import { buildInstructionIngredientTree } from "./buildInstructionIngredientTree.ts";
import { COMMON_CONTAINERS } from "./containers.ts";
import { InstructionIngredientSelector } from "./InstructionIngredientSelector.tsx";
import "../../pages/RecipeEditorPage.css";
import "./RecipeVersionEditor.css";

// ---------------------------------------------------------------------------
// Helper: heading level for section depth
// ---------------------------------------------------------------------------

type HeadingLevel = "h2" | "h3" | "h4" | "h5" | "h6";

function headingForDepth(depth: number): HeadingLevel {
  const levels: HeadingLevel[] = ["h2", "h3", "h4", "h5", "h6"];
  return levels[Math.min(depth - 1, levels.length - 1)] ?? "h6";
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
    if (item.customAmount !== undefined) {
      const unitMap = grouped.get(item.ingredient_id)!;
      const existing = unitMap.get(item.customAmount.unit);
      unitMap.set(
        item.customAmount.unit,
        existing !== undefined
          ? addFractions(existing, item.customAmount.value)
          : item.customAmount.value,
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
// Helper: compute the amount of an ingredient
// ---------------------------------------------------------------------------

export function computeAmountOrDefault(
  item: IngredientItem,
  allIngredients: ReadonlyDeep<Ingredient[]>,
): Measurement {
  if (item.customAmount) return item.customAmount;
  const ingredient = getByIdOrThrow(Ingredient, allIngredients, item.ingredient_id);
  return ingredient.default_measurement_value;
}

export function getByIdOrThrow<A extends ReadonlyDeep<V[]>, V extends { id: string }>(
  companion: AnyCompanion<V>,
  values: A,
  id: V["id"],
): A[number] {
  const found = values.find((v) => v.id === id);
  assertDefined(found, `Could not find ${companion.name} by id=${id}`);
  return found;
}

// ---------------------------------------------------------------------------
// Unit display labels
// ---------------------------------------------------------------------------

function formatAmount(value: Fraction, unit: MeasurementUnit): string {
  return `${formatFraction(value)} ${MeasurementUnit.display[unit]}`;
}

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
  currentAmount: Measurement | undefined,
  allIngredients: readonly Ingredient[],
): Measurement {
  const newIngredient = getByIdOrThrow(Ingredient, allIngredients, newIngredientId);
  if (
    currentAmount &&
    oldIngredientId &&
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

/**
 * Skipped-item decoration (session summary): items in `skippedIds` render with
 * the danger background and a floating "skipped" label, and offer Restore /
 * Dismiss actions instead of remove.
 */
interface WithSkippedItems {
  readonly skippedIds?: ReadonlySet<SectionItemId> | undefined;
  readonly onRestoreItem?: ((id: SectionItemId) => void) | undefined;
  readonly onDismissItem?: ((id: SectionItemId) => void) | undefined;
}

interface SkippedRowProps {
  readonly skipped?: boolean | undefined;
  readonly onRestore?: (() => void) | undefined;
  readonly onDismiss?: (() => void) | undefined;
}

interface SkippedRowActionsProps extends SkippedRowProps {
  /** Human-readable name used in the Restore/Dismiss accessible labels. */
  readonly itemName: string;
}

function SkippedRowActions({ itemName, onRestore, onDismiss }: SkippedRowActionsProps) {
  return (
    <>
      <span className="re-item-skipped-label">skipped</span>
      <button
        type="button"
        className="re-item-restore"
        onClick={onRestore}
        aria-label={`Restore ${itemName}`}
      >
        Restore
      </button>
      <button
        type="button"
        className="re-item-dismiss"
        onClick={onDismiss}
        aria-label={`Dismiss ${itemName}`}
      >
        ✕
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// IngredientItemRow
// ---------------------------------------------------------------------------

interface IngredientItemRowProps
  extends RecipeSectionItemRowProps<IngredientItem>, WithIngredients, SkippedRowProps {}

function IngredientItemRow({
  item,
  allIngredients,
  allLabels,
  onChange,
  onRemove,
  skipped,
  onRestore,
  onDismiss,
}: IngredientItemRowProps) {
  const [isEditingIngredient, setIsEditingIngredient] = useState(false);
  // The kitchenware store loads asynchronously; fall back to the raw id until
  // the ingredient arrives rather than crashing the editor.
  const ingredient = allIngredients.find((i) => i.id === item.ingredient_id);
  const ingredientName = ingredient?.name ?? item.ingredient_id;
  const amount = item.customAmount ?? ingredient?.default_measurement_value;

  function handleIngredientChange(id: IngredientId | undefined) {
    if (id) {
      const newAmount = resolveAmountOnIngredientChange(
        item.ingredient_id,
        id,
        item.customAmount,
        allIngredients,
      );
      onChange({ ...item, ingredient_id: id, customAmount: newAmount });
    }
    setIsEditingIngredient(false);
  }

  return (
    <div
      className={`re-item re-item--ingredients${skipped === true ? " re-item--skipped" : ""}`}
      role="group"
      aria-label={`Ingredient: ${ingredientName}`}
    >
      {isEditingIngredient ? (
        <>
          <IngredientSelector
            value={item.ingredient_id}
            options={allIngredients}
            labels={allLabels}
            onChange={handleIngredientChange}
            ariaLabel={`Change ingredient (currently ${ingredientName})`}
          />
          {amount !== undefined && (
            <MeasurementEditor
              value={amount}
              onCommit={(newAmount) => onChange({ ...item, customAmount: newAmount })}
            />
          )}
        </>
      ) : (
        <>
          <span
            className="re-item-label"
            title="Double-click to change ingredient"
            onDoubleClick={() => setIsEditingIngredient(true)}
          >
            {ingredientName}
          </span>
          {amount !== undefined && (
            <span className="re-item-amount">{formatAmount(amount.value, amount.unit)}</span>
          )}
        </>
      )}
      {skipped === true ? (
        <SkippedRowActions itemName={ingredientName} onRestore={onRestore} onDismiss={onDismiss} />
      ) : (
        <button
          type="button"
          className="re-item-remove"
          onClick={onRemove}
          aria-label={`Remove ingredient ${ingredientName}`}
        >
          −
        </button>
      )}
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
  const [amount, setAmount] = useState<Measurement | undefined>(undefined);

  const selectedIngredient =
    ingredient_id !== undefined ? allIngredients.find((i) => i.id === ingredient_id) : undefined;
  const selectedIngredientAmount = amount ?? selectedIngredient?.default_measurement_value;

  function handleSelectIngredient(id: IngredientId | undefined) {
    if (id !== undefined) {
      setAmount(resolveAmountOnIngredientChange(ingredient_id, id, amount, allIngredients));
    }
    setIngredientId(id);
  }

  function handleAdd() {
    if (!selectedIngredient) return;
    onAdd({
      kind: "ingredient",
      id: randomId(SectionItemId),
      ingredient_id: selectedIngredient.id,
      ...(amount ? { customAmount: amount } : {}),
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
      {selectedIngredientAmount && (
        <MeasurementEditor value={selectedIngredientAmount} onCommit={setAmount} />
      )}
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

interface ContainerItemRowProps
  extends RecipeSectionItemRowProps<ContainerItem>, WithIngredients, WithSkippedItems {}

function ContainerItemRow({
  item,
  allIngredients,
  allLabels,
  onChange,
  onRemove,
  skippedIds,
  onRestoreItem,
  onDismissItem,
}: ContainerItemRowProps) {
  const [showingNewIngredient, setShowingNewIngredient] = useState(false);
  const containerName =
    COMMON_CONTAINERS.find((c) => c.id === item.container_id)?.name ?? item.container_id;

  return (
    <div
      className="re-item re-item--container"
      role="group"
      aria-label={`Container: ${containerName} — ${item.descriptor}`}
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
          aria-label={`Remove container ${containerName}`}
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
            skipped={skippedIds?.has(content.id) === true}
            onRestore={() => onRestoreItem?.(content.id)}
            onDismiss={() => onDismissItem?.(content.id)}
            onChange={(updated) => {
              const newContents = item.contents.map((c, j) => (j === i ? updated : c));
              onChange({ ...item, contents: newContents });
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
            aria-label={`Add ingredient to ${containerName}`}
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
  { id: fixedId(EquipmentId, "oven"), name: "Oven" },
  { id: fixedId(EquipmentId, "stove"), name: "Stove" },
  { id: fixedId(EquipmentId, "mixer"), name: "Mixer" },
  { id: fixedId(EquipmentId, "blender"), name: "Blender" },
  { id: fixedId(EquipmentId, "knife"), name: "Knife" },
  { id: fixedId(EquipmentId, "skillet"), name: "Skillet" },
] as const;

interface InstructionRowProps extends RecipeSectionItemRowProps<Instruction>, SkippedRowProps {
  readonly instructionIngredientNodes: TreeNode[];
}

function InstructionRow({
  item,
  instructionIngredientNodes,
  onChange,
  onRemove,
  skipped,
  onRestore,
  onDismiss,
}: InstructionRowProps) {
  function handleIngredientsChange(ids: IngredientId[]) {
    if (ids.length > 0) {
      onChange({ ...item, ingredient_ids: ids });
    } else {
      const { ingredient_ids: _, ...rest } = item;
      onChange(rest);
    }
  }

  const instructionName = item.instruction || "instruction";

  return (
    <div
      className={`re-item re-item--instruction${skipped === true ? " re-item--skipped" : ""}`}
      role="group"
      aria-label={`Instruction: ${item.instruction || "new"}`}
    >
      <div className="re-item-header">
        <input
          className="re-instruction-text"
          value={item.instruction}
          onChange={(e) => onChange({ ...item, instruction: e.target.value })}
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
        {skipped === true ? (
          <SkippedRowActions
            itemName={instructionName}
            onRestore={onRestore}
            onDismiss={onDismiss}
          />
        ) : (
          <button
            type="button"
            className="re-item-remove"
            onClick={onRemove}
            aria-label="Remove instruction"
          >
            −
          </button>
        )}
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
        <InstructionIngredientSelector
          nodes={instructionIngredientNodes}
          selectedIds={item.ingredient_ids ?? []}
          onChange={handleIngredientsChange}
        />
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

interface SectionEditorProps
  extends RecipeSectionItemRowProps<Section>, WithIngredients, WithSkippedItems {
  readonly depth: number;
  readonly instructionIngredientNodes: TreeNode[];
}

function SectionEditor({
  item: section,
  depth,
  allIngredients,
  allLabels,
  instructionIngredientNodes,
  onChange,
  onRemove,
  skippedIds,
  onRestoreItem,
  onDismissItem,
}: SectionEditorProps) {
  const [showingNewIngredient, setShowingNewIngredient] = useState(false);
  // The header input is hidden until requested; a section that already has a
  // header (e.g. an existing recipe) shows it straight away.
  const [showHeaderInput, setShowHeaderInput] = useState(section.header !== undefined);
  const headerInputRef = useRef<HTMLInputElement>(null);
  const Heading = headingForDepth(depth);

  function updateItem(index: number, updated: SectionItem) {
    const newContents = section.contents.map((item, i) => (i === index ? updated : item));
    onChange({ ...section, contents: newContents });
  }

  function removeItem(index: number) {
    onChange({ ...section, contents: section.contents.filter((_, i) => i !== index) });
  }

  function addItem(kind: NewItemKind) {
    if (kind === "ingredient") {
      setShowingNewIngredient(true);
      return;
    }
    const newId = randomId(SectionItemId);
    let newItem: SectionItem;
    if (kind === "container") {
      newItem = {
        kind: "container",
        id: newId,
        container_id: COMMON_CONTAINERS[0].id,
        descriptor: "",
        contents: [],
      };
    } else if (kind === "instruction") {
      newItem = { kind: "instruction", id: newId, instruction: "" };
    } else if (kind === "text_block") {
      newItem = { kind: "text_block", id: newId, text: "" };
    } else {
      if (depth >= 5) return;
      newItem = { kind: "section", id: newId, contents: [] };
    }
    onChange({ ...section, contents: [...section.contents, newItem] });
  }

  return (
    <div
      role="group"
      className={`re-section re-section--depth-${depth}`}
      aria-label={`Section: ${section.header ?? "unnamed"}`}
    >
      <div className="re-section-header-row">
        {showHeaderInput ? (
          <Heading className="re-section-heading">
            <input
              ref={headerInputRef}
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
              aria-label="Section header"
            />
          </Heading>
        ) : (
          <button
            type="button"
            className="re-add-section-header-btn"
            onClick={() => {
              setShowHeaderInput(true);
              // The input mounts on this state change, so defer focus until
              // it is in the DOM.
              setTimeout(() => headerInputRef.current?.focus(), 0);
            }}
            aria-label="Add section header"
          >
            + Add Section Header
          </button>
        )}
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
                skipped={skippedIds?.has(item.id) === true}
                onRestore={() => onRestoreItem?.(item.id)}
                onDismiss={() => onDismissItem?.(item.id)}
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
                skippedIds={skippedIds}
                onRestoreItem={onRestoreItem}
                onDismissItem={onDismissItem}
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
                instructionIngredientNodes={instructionIngredientNodes}
                skipped={skippedIds?.has(item.id) === true}
                onRestore={() => onRestoreItem?.(item.id)}
                onDismiss={() => onDismissItem?.(item.id)}
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
                instructionIngredientNodes={instructionIngredientNodes}
                skippedIds={skippedIds}
                onRestoreItem={onRestoreItem}
                onDismissItem={onDismissItem}
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
// RecipeVersionEditor — computed ingredients + editable instruction sections
// ---------------------------------------------------------------------------

export interface RecipeVersionEditorProps extends WithSkippedItems {
  readonly sections: Section[];
  readonly onChange: (sections: Section[]) => void;
}

/**
 * The editable body of a RecipeVersion: the computed Ingredients display and
 * the Instructions section tree. Shared by the recipe editor page and the
 * session summary (where `skippedIds` decorates skipped items with Restore /
 * Dismiss actions; still-skipped items are excluded from the aggregate
 * ingredient totals since they will be removed on save).
 */
export function RecipeVersionEditor({
  sections,
  onChange,
  skippedIds,
  onRestoreItem,
  onDismissItem,
}: RecipeVersionEditorProps) {
  const { ingredients } = useIngredientStore();
  const { labels } = useLabelStore();

  const instructionIngredientNodes = useMemo(
    () => buildInstructionIngredientTree(sections, ingredients),
    [sections, ingredients],
  );
  const displaySections = useMemo(
    () =>
      skippedIds !== undefined && skippedIds.size > 0
        ? removeSectionItemsById(sections, skippedIds)
        : sections,
    [sections, skippedIds],
  );

  return (
    <>
      {/* Computed ingredients list */}
      <RecipeIngredientsDisplay sections={displaySections} allIngredients={ingredients} />

      {/* Instruction sections */}
      <section className="re-section-block" aria-label="Instructions">
        <h2 className="re-section-title">Instructions</h2>
        {sections.map((sec, i) => (
          <SectionEditor
            key={sec.id}
            item={sec}
            depth={1}
            allIngredients={ingredients}
            allLabels={labels}
            instructionIngredientNodes={instructionIngredientNodes}
            skippedIds={skippedIds}
            onRestoreItem={onRestoreItem}
            onDismissItem={onDismissItem}
            onChange={(updated) => onChange(sections.map((s, j) => (j === i ? updated : s)))}
            onRemove={() => onChange(sections.filter((_, j) => j !== i))}
          />
        ))}
        <button
          type="button"
          className="re-add-section-btn"
          onClick={() => {
            const newSection: Section = {
              kind: "section",
              id: randomId(SectionItemId),
              contents: [],
            };
            onChange([...sections, newSection]);
          }}
          aria-label="Add section"
        >
          + Add section
        </button>
      </section>
    </>
  );
}
