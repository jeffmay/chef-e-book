import { useState } from "react";
import {
  type ContainerItem,
  type Ingredient,
  type IngredientItem,
  type Instruction,
  type Recipe,
  type RecipeFolderId,
  type RecipeIngredient,
  type RecipeVersion,
  type Section,
  type SectionItem,
  type TextBlock,
  loadId,
  paddedId,
  randomId,
  ContainerId,
  EquipmentId,
  RecipeFolderId as RecipeFolderIdCompanion,
  RecipeIngredientId,
  RecipeVersionId,
  SectionItemId,
  IngredientId,
} from "@recipe-book/shared";
import { ReadonlyDeep } from "type-fest";
import { MeasurementEditor } from "../components/measurement/MeasurementEditor.js";
import { DurationEditor } from "../components/duration/DurationEditor.js";
import { useIngredientStore } from "../hooks/useIngredientStore.js";
import { useRecipeFolderStore } from "../hooks/useRecipeFolderStore.js";
import { useRecipeStore, latestVersion } from "../hooks/useRecipeStore.js";
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
    result.push({ id: f.id, label: " ".repeat(depth * 2) + f.name });
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
// NotesPanel
// ---------------------------------------------------------------------------

interface NotesPanelProps {
  readonly notes: string[];
  readonly onChange: (notes: string[]) => void;
}

function NotesPanel({ notes, onChange }: NotesPanelProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  function submitNote() {
    const trimmed = draft.trim();
    if (trimmed) onChange([...notes, trimmed]);
    setDraft("");
    setAdding(false);
  }

  return (
    <aside className="re-notes-panel" aria-label="Notes">
      <ul className="re-notes-list">
        {notes.map((note, i) => (
          <li key={i} className="re-note-item">
            <span className="re-note-text">{note}</span>
            <button
              type="button"
              className="re-note-remove"
              onClick={() => onChange(notes.filter((_, j) => j !== i))}
              aria-label={`Remove note: ${note}`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {adding ? (
        <span className="re-notes-add-row">
          <input
            className="re-notes-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitNote()}
            placeholder="Add a note…"
            aria-label="New note text"
            autoFocus
          />
          <button type="button" onClick={submitNote} aria-label="Save note">
            ✓
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setDraft("");
            }}
            aria-label="Cancel note"
          >
            ✕
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="re-notes-add-btn"
          onClick={() => setAdding(true)}
          aria-label="Add note"
        >
          + note
        </button>
      )}
    </aside>
  );
}

interface RecipeSectionItemRowProps<T extends SectionItem = SectionItem> {
  readonly item: T;
  readonly onChange: (item: T) => void;
  readonly onRemove: () => void;
}

interface WithIngredients {
  readonly allIngredients: ReadonlyDeep<Ingredient[]>;
  readonly topIngredients: ReadonlyDeep<RecipeIngredient[]>;
}

// ---------------------------------------------------------------------------
// IngredientItemRow
// ---------------------------------------------------------------------------

interface IngredientItemRowProps
  extends RecipeSectionItemRowProps<IngredientItem>, WithIngredients {}

function IngredientItemRow({
  item,
  topIngredients,
  allIngredients,
  onChange,
  onRemove,
}: IngredientItemRowProps) {
  const top = topIngredients.find((ti) => ti.ingredient_id === item.ingredient_id);
  const ingredient = allIngredients.find((i) => i.id === item.ingredient_id);
  const name = ingredient?.name ?? item.ingredient_id;
  const amount_from_top = top?.amount;

  return (
    <div className="re-item re-item--ingredient" role="group" aria-label={`Ingredient: ${name}`}>
      <span className="re-item-label">{name}</span>
      {amount_from_top !== undefined ? (
        <span
          className="re-item-amount re-item-amount--inherited"
          title="Amount from top-level ingredients"
        >
          {/* Amount inherited from top-level; hidden inline */}
        </span>
      ) : (
        <MeasurementEditor
          value={item.amount ?? { value: { numerator: 1, denominator: 1 }, unit: "cup" }}
          onCommit={(amount) => onChange({ ...item, amount })}
        />
      )}
      <NotesPanel notes={item.notes ?? []} onChange={(notes) => onChange({ ...item, notes })} />
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
  topIngredients,
  allIngredients,
  onChange,
  onRemove,
}: ContainerItemRowProps) {
  const container_name =
    COMMON_CONTAINERS.find((c) => c.id === item.container_id)?.name ?? item.container_id;

  function addContentIngredient(ingredient_id: string) {
    if (!ingredient_id) return;
    const new_item: IngredientItem = {
      kind: "ingredient",
      id: randomId(SectionItemId),
      ingredient_id: ingredient_id as IngredientItem["ingredient_id"],
    };
    onChange({ ...item, contents: [...item.contents, new_item] });
  }

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
            topIngredients={topIngredients}
            allIngredients={allIngredients}
            onChange={(updated) => {
              const new_contents = item.contents.map((c, j) => (j === i ? updated : c));
              onChange({ ...item, contents: new_contents });
            }}
            onRemove={() =>
              onChange({ ...item, contents: item.contents.filter((_, j) => j !== i) })
            }
          />
        ))}
        <select
          className="re-container-add-ingredient"
          value=""
          onChange={(e) => {
            addContentIngredient(e.target.value);
            e.target.value = "";
          }}
          aria-label="Add ingredient to container"
        >
          <option value="">+ Add ingredient…</option>
          {allIngredients.map((ing) => (
            <option key={ing.id} value={ing.id}>
              {ing.name}
            </option>
          ))}
        </select>
      </div>
      <NotesPanel notes={item.notes ?? []} onChange={(notes) => onChange({ ...item, notes })} />
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

interface InstructionRowProps extends RecipeSectionItemRowProps<Instruction>, WithIngredients {
  readonly onAddTopIngredient: (id: IngredientId) => void;
}

function InstructionRow({
  item,
  topIngredients,
  allIngredients,
  onChange,
  onRemove,
  onAddTopIngredient,
}: InstructionRowProps) {
  function toggleIngredient(id: IngredientId) {
    const current = item.ingredient_ids ?? [];
    const exists = current.includes(id);
    const newIds = exists ? current.filter((x) => x !== id) : [...current, id];
    // If adding a new ingredient not in top-level list, add it there too
    if (!exists && !topIngredients.some((ti) => ti.ingredient_id === id)) {
      onAddTopIngredient(id);
    }
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
          const checked = (item.ingredient_ids ?? []).includes(
            ing.id as IngredientItem["ingredient_id"],
          );
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

      <NotesPanel notes={item.notes ?? []} onChange={(notes) => onChange({ ...item, notes })} />
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
      <NotesPanel notes={item.notes ?? []} onChange={(notes) => onChange({ ...item, notes })} />
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
  readonly onAddTopIngredient: (id: IngredientId) => void;
}

function SectionEditor({
  item: section,
  depth,
  topIngredients,
  allIngredients,
  onChange,
  onRemove,
  onAddTopIngredient,
}: SectionEditorProps) {
  const Heading = headingForDepth(depth);

  function updateItem(index: number, updated: SectionItem) {
    const new_contents = section.contents.map((item, i) => (i === index ? updated : item));
    onChange({ ...section, contents: new_contents });
  }

  function removeItem(index: number) {
    onChange({ ...section, contents: section.contents.filter((_, i) => i !== index) });
  }

  function addItem(kind: NewItemKind) {
    const new_id = randomId(SectionItemId);
    let new_item: SectionItem;
    if (kind === "ingredient") {
      new_item = {
        kind: "ingredient",
        id: new_id,
        ingredient_id: allIngredients[0]?.id ?? loadId(IngredientId, ""),
      };
    } else if (kind === "container") {
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
        <NotesPanel
          notes={section.notes ?? []}
          onChange={(notes) => onChange({ ...section, notes })}
        />
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
                topIngredients={topIngredients}
                allIngredients={allIngredients}
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
                topIngredients={topIngredients}
                allIngredients={allIngredients}
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
                topIngredients={topIngredients}
                allIngredients={allIngredients}
                onChange={(updated) => updateItem(i, updated)}
                onRemove={() => removeItem(i)}
                onAddTopIngredient={onAddTopIngredient}
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
                topIngredients={topIngredients}
                allIngredients={allIngredients}
                onChange={(updated) => updateItem(i, updated)}
                onRemove={() => removeItem(i)}
                onAddTopIngredient={onAddTopIngredient}
              />
            );
          }
          return null;
        })}
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
// RecipeIngredientsEditor
// ---------------------------------------------------------------------------

interface RecipeIngredientsEditorProps {
  readonly ingredients: RecipeIngredient[];
  readonly allIngredients: readonly Ingredient[];
  readonly onChange: (ingredients: RecipeIngredient[]) => void;
}

function RecipeIngredientsEditor({
  ingredients,
  allIngredients,
  onChange,
}: RecipeIngredientsEditorProps) {
  const [addingAmountFor, setAddingAmountFor] = useState<string | null>(null);

  function addIngredient(ingredient_id: string) {
    if (!ingredient_id) return;
    const already_added = ingredients.some((ri) => ri.ingredient_id === ingredient_id);
    if (already_added) return;
    const new_ri: RecipeIngredient = {
      id: randomId(RecipeIngredientId),
      ingredient_id: ingredient_id as RecipeIngredient["ingredient_id"],
    };
    onChange([...ingredients, new_ri]);
  }

  return (
    <section className="re-section-block" aria-label="Ingredients">
      <h2 className="re-section-title">Ingredients</h2>
      <div className="re-ing-list">
        {ingredients.map((ri, i) => {
          const ing = allIngredients.find((a) => a.id === ri.ingredient_id);
          const name = ing?.name ?? ri.ingredient_id;
          return (
            <div key={ri.id} className="re-ing-row" role="group" aria-label={`Ingredient: ${name}`}>
              <span className="re-ing-name">{name}</span>
              <span className="re-ing-amount">
                {ri.amount !== undefined ? (
                  <MeasurementEditor
                    value={ri.amount}
                    onCommit={(amount) => {
                      const updated = ingredients.map((x, j) => (j === i ? { ...x, amount } : x));
                      onChange(updated);
                    }}
                  />
                ) : addingAmountFor === ri.id ? (
                  <MeasurementEditor
                    value={{ value: { numerator: 1, denominator: 1 }, unit: "cup" }}
                    initiallyOpen
                    onCommit={(amount) => {
                      const updated = ingredients.map((x, j) => (j === i ? { ...x, amount } : x));
                      onChange(updated);
                      setAddingAmountFor(null);
                    }}
                    onCancel={() => setAddingAmountFor(null)}
                  />
                ) : (
                  <span className="re-ing-amount-calc" title="Calculated from sections">
                    (calculated)
                    <button
                      type="button"
                      className="re-ing-add-amount"
                      onClick={() => setAddingAmountFor(ri.id)}
                      aria-label={`Add amount for ${name}`}
                    >
                      + amount
                    </button>
                  </span>
                )}
              </span>
              <button
                type="button"
                className="re-ing-remove"
                onClick={() => onChange(ingredients.filter((_, j) => j !== i))}
                aria-label={`Remove ${name}`}
              >
                −
              </button>
            </div>
          );
        })}
      </div>
      <select
        className="re-ing-add-select"
        value=""
        onChange={(e) => {
          addIngredient(e.target.value);
          e.target.value = "";
        }}
        aria-label="Add ingredient to recipe"
      >
        <option value="">+ Add ingredient…</option>
        {allIngredients
          .filter((ing) => !ingredients.some((ri) => ri.ingredient_id === ing.id))
          .map((ing) => (
            <option key={ing.id} value={ing.id}>
              {ing.name}
            </option>
          ))}
      </select>
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
  const sorted = [...versions].reverse(); // newest first

  return (
    <details
      className="re-version-history"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="re-version-history-summary">Version history ({versions.length})</summary>
      <div className="re-version-history-body">
        <div className="re-version-filter" role="search" aria-label="Filter versions">
          {/* placeholder for filter bar */}
        </div>
        <table className="re-version-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Editor</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((v) => (
              <tr key={v.id}>
                <td>{new Date(v.created_at).toLocaleDateString()}</td>
                {/* <td>{v.created_by}</td> */}
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
              setFolderId(
                e.target.value ? loadId(RecipeFolderIdCompanion, e.target.value) : undefined,
              )
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
  ingredients: RecipeIngredient[];
  sections: Section[];
  create_new_version: boolean;
}

function makeInitialState(recipe: Recipe | null, versionId?: string): EditorState {
  if (recipe === null) {
    return {
      title: "",
      subtitle: "",
      source_url: "",
      parent_folder_id: undefined,
      description: "",
      ingredients: [],
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
    ingredients: v?.ingredients ?? [],
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
  readonly onSave: (recipe: Recipe) => void;
  readonly onCancel: () => void;
}

export function RecipeEditor({ recipe, versionId, onSave, onCancel }: RecipeEditorProps) {
  const { create, save, copy } = useRecipeStore();
  const { flatFolders, folders } = useRecipeFolderStore();
  const { ingredients } = useIngredientStore();
  const [form, setForm] = useState<EditorState>(() => makeInitialState(recipe, versionId));
  const [showCopyDialog, setShowCopyDialog] = useState(false);

  const flat = flattenFolders(folders);

  function patch<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addTopIngredient(ingredient_id: IngredientItem["ingredient_id"]) {
    if (form.ingredients.some((ri) => ri.ingredient_id === ingredient_id)) return;
    setForm((f) => ({
      ...f,
      ingredients: [...f.ingredients, { id: randomId(RecipeIngredientId), ingredient_id }],
    }));
  }

  function handleSave() {
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
        ingredients: form.ingredients,
        sections: form.sections,
        created_at: v?.created_at ?? Date.now(),
        // created_by: v?.created_by ?? userName,
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
          Source URL
          <input
            className="re-field-input"
            type="url"
            value={form.source_url}
            onChange={(e) => patch("source_url", e.target.value)}
            placeholder="Recipe Source URL"
            aria-label="Source URL"
          />
        </label>

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
          Version note
          <input
            className="re-field-input"
            value={form.description}
            onChange={(e) => patch("description", e.target.value)}
            placeholder='ex: "Untested" or "Final Version"'
            aria-label="Version description"
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
                e.target.value ? loadId(RecipeFolderIdCompanion, e.target.value) : undefined,
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

      {/* Top-level ingredients */}
      <RecipeIngredientsEditor
        ingredients={form.ingredients}
        allIngredients={ingredients}
        onChange={(ingredients) => patch("ingredients", ingredients)}
      />

      {/* Instruction sections */}
      <section className="re-section-block" aria-label="Instructions">
        <h2 className="re-section-title">Instructions</h2>
        {form.sections.map((sec, i) => (
          <SectionEditor
            key={sec.id}
            item={sec}
            depth={1}
            topIngredients={form.ingredients}
            allIngredients={ingredients}
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
            onAddTopIngredient={addTopIngredient}
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
      <section className="re-actions" aria-label="Save actions">
        {recipe && (
          <label className="re-new-version-label">
            <input
              type="checkbox"
              checked={form.create_new_version}
              onChange={(e) => patch("create_new_version", e.target.checked)}
              aria-label="Create a new version from changes"
            />
            Create a new version from changes
          </label>
        )}
        <button
          type="button"
          className="re-save-btn"
          onClick={handleSave}
          disabled={form.title.trim() === ""}
          aria-label="Save recipe"
        >
          Save updates
        </button>
        <button type="button" className="re-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
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

// ---------------------------------------------------------------------------
// RecipeList
// ---------------------------------------------------------------------------

interface RecipeListProps {
  readonly recipes: Recipe[];
  readonly onSelect: (recipe: Recipe) => void;
  readonly onNew: () => void;
}

function RecipeList({ recipes, onSelect, onNew }: RecipeListProps) {
  return (
    <main className="re-list-page" aria-label="Recipe list">
      <h1 className="page-title">Recipes</h1>
      <button type="button" className="re-new-btn" onClick={onNew} aria-label="New recipe">
        + New recipe
      </button>
      {recipes.length === 0 ? (
        <p className="re-list-empty">No recipes yet. Create your first one!</p>
      ) : (
        <ul className="re-list">
          {recipes.map((r) => {
            const v = latestVersion(r);
            return (
              <li key={r.id} className="re-list-item">
                <button
                  type="button"
                  className="re-list-item-btn"
                  onClick={() => onSelect(r)}
                  aria-label={`Edit recipe: ${r.title}`}
                >
                  <span className="re-list-item-title">{r.title}</span>
                  {r.subtitle && <span className="re-list-item-subtitle">{r.subtitle}</span>}
                  {v?.description && <span className="re-list-item-desc">{v.description}</span>}
                  <span className="re-list-item-date">
                    {new Date(r.updated_at).toLocaleDateString()}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// RecipeEditorPage
// ---------------------------------------------------------------------------

type EditingState = { kind: "new" } | { kind: "edit"; recipe: Recipe } | null;

export function RecipeEditorPage() {
  const { recipes } = useRecipeStore();
  const [editing, setEditing] = useState<EditingState>(null);

  if (editing !== null) {
    return (
      <RecipeEditor
        recipe={editing.kind === "new" ? null : editing.recipe}
        onSave={() => setEditing(null)}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <RecipeList
      recipes={recipes}
      onSelect={(r) => setEditing({ kind: "edit", recipe: r })}
      onNew={() => setEditing({ kind: "new" })}
    />
  );
}
