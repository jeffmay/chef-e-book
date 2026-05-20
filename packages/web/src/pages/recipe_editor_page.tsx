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
  randomId,
  EquipmentId,
  RecipeIngredientId,
  RecipeVersionId,
  SectionItemId,
} from "@recipe-book/shared";
import { MeasurementEditor } from "../components/measurement/measurement_editor.js";
import { DurationEditor } from "../components/duration/duration_editor.js";
import { useIngredientStore } from "../hooks/use_ingredient_store.js";
import { useRecipeFolderStore } from "../hooks/use_recipe_folder_store.js";
import { useRecipeStore, latestVersion } from "../hooks/use_recipe_store.js";
import "./recipe_editor_page.css";

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
    <aside className="re_notes_panel" aria-label="Notes">
      <ul className="re_notes_list">
        {notes.map((note, i) => (
          <li key={i} className="re_note_item">
            <span className="re_note_text">{note}</span>
            <button
              type="button"
              className="re_note_remove"
              onClick={() => onChange(notes.filter((_, j) => j !== i))}
              aria-label={`Remove note: ${note}`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {adding ? (
        <span className="re_notes_add_row">
          <input
            className="re_notes_input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitNote()}
            placeholder="Add a note…"
            aria-label="New note text"
            autoFocus
          />
          <button type="button" onClick={submitNote} aria-label="Save note">✓</button>
          <button type="button" onClick={() => { setAdding(false); setDraft(""); }} aria-label="Cancel note">✕</button>
        </span>
      ) : (
        <button
          type="button"
          className="re_notes_add_btn"
          onClick={() => setAdding(true)}
          aria-label="Add note"
        >
          + note
        </button>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// IngredientItemRow
// ---------------------------------------------------------------------------

interface IngredientItemRowProps {
  readonly item: IngredientItem;
  readonly top_ingredients: RecipeIngredient[];
  readonly all_ingredients: readonly Ingredient[];
  readonly onChange: (item: IngredientItem) => void;
  readonly onRemove: () => void;
}

function IngredientItemRow({
  item,
  top_ingredients,
  all_ingredients,
  onChange,
  onRemove,
}: IngredientItemRowProps) {
  const top = top_ingredients.find((ti) => ti.ingredient_id === item.ingredient_id);
  const ingredient = all_ingredients.find((i) => i.id === item.ingredient_id);
  const name = ingredient?.name ?? item.ingredient_id;
  const amount_from_top = top?.amount;

  return (
    <div className="re_item re_item--ingredient" role="group" aria-label={`Ingredient: ${name}`}>
      <span className="re_item_label">{name}</span>
      {amount_from_top !== undefined ? (
        <span className="re_item_amount re_item_amount--inherited" title="Amount from top-level ingredients">
          {/* Amount inherited from top-level; hidden inline */}
        </span>
      ) : (
        <MeasurementEditor
          value={item.amount ?? { value: { numerator: 1, denominator: 1 }, unit: "cup" }}
          onCommit={(amount) => onChange({ ...item, amount })}
        />
      )}
      <NotesPanel
        notes={item.notes ?? []}
        onChange={(notes) => onChange({ ...item, notes })}
      />
      <button type="button" className="re_item_remove" onClick={onRemove} aria-label={`Remove ingredient ${name}`}>−</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContainerItemRow
// ---------------------------------------------------------------------------

const COMMON_CONTAINERS = [
  { id: "----------bowl", name: "Bowl" },
  { id: "----------pot", name: "Pot" },
  { id: "-------steamer", name: "Steamer" },
  { id: "----------foil", name: "Foil" },
  { id: "----------pan", name: "Pan" },
  { id: "---------plate", name: "Plate" },
] as const;

interface ContainerItemRowProps {
  readonly item: ContainerItem;
  readonly top_ingredients: RecipeIngredient[];
  readonly all_ingredients: readonly Ingredient[];
  readonly onChange: (item: ContainerItem) => void;
  readonly onRemove: () => void;
}

function ContainerItemRow({ item, top_ingredients, all_ingredients, onChange, onRemove }: ContainerItemRowProps) {
  const container_name = COMMON_CONTAINERS.find((c) => c.id === item.container_id)?.name ?? item.container_id;

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
    <div className="re_item re_item--container" role="group" aria-label={`Container: ${container_name} — ${item.descriptor}`}>
      <div className="re_item_header">
        <select
          className="re_container_select"
          value={item.container_id}
          onChange={(e) => onChange({ ...item, container_id: e.target.value as ContainerItem["container_id"] })}
          aria-label="Container type"
        >
          {COMMON_CONTAINERS.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input
          className="re_container_descriptor"
          value={item.descriptor}
          onChange={(e) => onChange({ ...item, descriptor: e.target.value })}
          placeholder="Descriptor (e.g. large, wet ingredients)"
          aria-label="Container descriptor"
        />
        <label className="re_container_ordered">
          <input
            type="checkbox"
            checked={item.ordered ?? false}
            onChange={(e) => onChange({ ...item, ordered: e.target.checked })}
            aria-label="Ordered list"
          />
          ordered
        </label>
        <button type="button" className="re_item_remove" onClick={onRemove} aria-label={`Remove container ${container_name}`}>−</button>
      </div>
      <div className="re_container_contents">
        {item.contents.map((content, i) => (
          <IngredientItemRow
            key={content.id}
            item={content}
            top_ingredients={top_ingredients}
            all_ingredients={all_ingredients}
            onChange={(updated) => {
              const new_contents = item.contents.map((c, j) => (j === i ? updated : c));
              onChange({ ...item, contents: new_contents });
            }}
            onRemove={() => onChange({ ...item, contents: item.contents.filter((_, j) => j !== i) })}
          />
        ))}
        <select
          className="re_container_add_ingredient"
          value=""
          onChange={(e) => { addContentIngredient(e.target.value); e.target.value = ""; }}
          aria-label="Add ingredient to container"
        >
          <option value="">+ Add ingredient…</option>
          {all_ingredients.map((ing) => (
            <option key={ing.id} value={ing.id}>{ing.name}</option>
          ))}
        </select>
      </div>
      <NotesPanel
        notes={item.notes ?? []}
        onChange={(notes) => onChange({ ...item, notes })}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// InstructionRow
// ---------------------------------------------------------------------------

const COMMON_EQUIPMENT = [
  { id: "--------oven", name: "Oven" },
  { id: "------stove", name: "Stove" },
  { id: "-------mixer", name: "Mixer" },
  { id: "------blender", name: "Blender" },
  { id: "---------knife", name: "Knife" },
  { id: "-------skillet", name: "Skillet" },
] as const;

interface InstructionRowProps {
  readonly item: Instruction;
  readonly top_ingredients: RecipeIngredient[];
  readonly all_ingredients: readonly Ingredient[];
  readonly onChange: (item: Instruction) => void;
  readonly onRemove: () => void;
  readonly onAddTopIngredient: (ingredient_id: IngredientItem["ingredient_id"]) => void;
}

function InstructionRow({ item, top_ingredients, all_ingredients, onChange, onRemove, onAddTopIngredient }: InstructionRowProps) {
  function toggleIngredient(ingredient_id: IngredientItem["ingredient_id"]) {
    const current = item.ingredient_ids ?? [];
    const exists = current.includes(ingredient_id);
    const new_ids = exists
      ? current.filter((id) => id !== ingredient_id)
      : [...current, ingredient_id];
    // If adding a new ingredient not in top-level list, add it there too
    if (!exists && !top_ingredients.some((ti) => ti.ingredient_id === ingredient_id)) {
      onAddTopIngredient(ingredient_id);
    }
    if (new_ids.length > 0) {
      onChange({ ...item, ingredient_ids: new_ids });
    } else {
      const { ingredient_ids: _, ...rest } = item;
      onChange(rest as Instruction);
    }
  }

  return (
    <div className="re_item re_item--instruction" role="group" aria-label={`Instruction: ${item.instruction || "new"}`}>
      <div className="re_item_header">
        <input
          className="re_instruction_text"
          value={item.instruction}
          onChange={(e) => onChange({ ...item, instruction: e.target.value })}
          placeholder="Action (e.g. mix, bake, stir)"
          aria-label="Instruction text"
        />
        <select
          className="re_instruction_equipment"
          value={item.equipment_id ?? ""}
          onChange={(e) => {
            if (e.target.value) {
              onChange({ ...item, equipment_id: loadId(EquipmentId, e.target.value) });
            } else {
              const { equipment_id: _, ...rest } = item;
              onChange(rest as Instruction);
            }
          }}
          aria-label="Equipment"
        >
          <option value="">— No equipment —</option>
          {COMMON_EQUIPMENT.map((eq) => (
            <option key={eq.id} value={eq.id}>{eq.name}</option>
          ))}
        </select>
        <button type="button" className="re_item_remove" onClick={onRemove} aria-label="Remove instruction">−</button>
      </div>

      <div className="re_instruction_duration">
        <label className="re_instruction_duration_label">
          Duration:
          {item.duration_seconds !== undefined ? (
            <DurationEditor
              value={item.duration_seconds}
              onCommit={(s) => onChange({ ...item, duration_seconds: s })}
            />
          ) : (
            <button
              type="button"
              className="re_instruction_add_duration"
              onClick={() => onChange({ ...item, duration_seconds: 300 })}
            >
              + Add duration
            </button>
          )}
        </label>
        {item.duration_seconds !== undefined && (
          <button
            type="button"
            className="re_instruction_remove_duration"
            onClick={() => {
              const { duration_seconds: _, ...rest } = item;
              onChange(rest as Instruction);
            }}
            aria-label="Remove duration"
          >
            ×
          </button>
        )}
      </div>

      <div className="re_instruction_ingredients">
        <span className="re_instruction_ing_label">Ingredients:</span>
        {all_ingredients.map((ing) => {
          const checked = (item.ingredient_ids ?? []).includes(ing.id as IngredientItem["ingredient_id"]);
          const top = top_ingredients.find((ti) => ti.ingredient_id === ing.id);
          return (
            <label key={ing.id} className="re_instruction_ing_option">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleIngredient(ing.id as IngredientItem["ingredient_id"])}
                aria-label={ing.name}
              />
              {ing.name}
              {checked && top?.amount === undefined && (
                <MeasurementEditor
                  value={{ value: { numerator: 1, denominator: 1 }, unit: "cup" }}
                  onCommit={(amount) => {
                    // Update the ingredient amount on the top-level RecipeIngredient
                    // This is handled by the parent; we emit a signal here
                    void amount;
                  }}
                />
              )}
            </label>
          );
        })}
      </div>

      <NotesPanel
        notes={item.notes ?? []}
        onChange={(notes) => onChange({ ...item, notes })}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// TextBlockRow
// ---------------------------------------------------------------------------

interface TextBlockRowProps {
  readonly item: TextBlock;
  readonly onChange: (item: TextBlock) => void;
  readonly onRemove: () => void;
}

function TextBlockRow({ item, onChange, onRemove }: TextBlockRowProps) {
  return (
    <div className="re_item re_item--text_block" role="group" aria-label="Text block">
      <textarea
        className="re_text_block_input"
        value={item.text}
        onChange={(e) => onChange({ ...item, text: e.target.value })}
        placeholder="Enter text…"
        aria-label="Text block content"
        rows={3}
      />
      <NotesPanel
        notes={item.notes ?? []}
        onChange={(notes) => onChange({ ...item, notes })}
      />
      <button type="button" className="re_item_remove" onClick={onRemove} aria-label="Remove text block">−</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionEditor (recursive)
// ---------------------------------------------------------------------------

type NewItemKind = "ingredient" | "container" | "instruction" | "text_block" | "section";

interface SectionEditorProps {
  readonly section: Section;
  readonly depth: number;
  readonly top_ingredients: RecipeIngredient[];
  readonly all_ingredients: readonly Ingredient[];
  readonly onChange: (section: Section) => void;
  readonly onRemove: () => void;
  readonly onAddTopIngredient: (ingredient_id: IngredientItem["ingredient_id"]) => void;
}

function SectionEditor({
  section,
  depth,
  top_ingredients,
  all_ingredients,
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
        ingredient_id: all_ingredients[0]?.id ?? ("" as IngredientItem["ingredient_id"]),
      };
    } else if (kind === "container") {
      new_item = {
        kind: "container",
        id: new_id,
        container_id: COMMON_CONTAINERS[0]!.id as ContainerItem["container_id"],
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
    <div role="group" className={`re_section re_section--depth_${depth}`} aria-label={`Section: ${section.header ?? "unnamed"}`}>
      <div className="re_section_header_row">
        <Heading className="re_section_heading">
          <input
            className="re_section_header_input"
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
        <button type="button" className="re_item_remove" onClick={onRemove} aria-label="Remove section">−</button>
      </div>

      <div className="re_section_contents">
        {section.contents.map((item, i) => {
          if (item.kind === "ingredient") {
            return (
              <IngredientItemRow
                key={item.id}
                item={item}
                top_ingredients={top_ingredients}
                all_ingredients={all_ingredients}
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
                top_ingredients={top_ingredients}
                all_ingredients={all_ingredients}
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
                top_ingredients={top_ingredients}
                all_ingredients={all_ingredients}
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
                section={item}
                depth={depth + 1}
                top_ingredients={top_ingredients}
                all_ingredients={all_ingredients}
                onChange={(updated) => updateItem(i, updated)}
                onRemove={() => removeItem(i)}
                onAddTopIngredient={onAddTopIngredient}
              />
            );
          }
          return null;
        })}
      </div>

      <div className="re_section_add_row">
        <span className="re_section_add_label">Add:</span>
        <button type="button" onClick={() => addItem("ingredient")} aria-label="Add ingredient to section">Ingredient</button>
        <button type="button" onClick={() => addItem("container")} aria-label="Add container to section">Container</button>
        <button type="button" onClick={() => addItem("instruction")} aria-label="Add instruction to section">Instruction</button>
        <button type="button" onClick={() => addItem("text_block")} aria-label="Add text block to section">Text</button>
        {depth < 5 && (
          <button type="button" onClick={() => addItem("section")} aria-label="Add sub-section">Sub-section</button>
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
  readonly all_ingredients: readonly Ingredient[];
  readonly onChange: (ingredients: RecipeIngredient[]) => void;
}

function RecipeIngredientsEditor({ ingredients, all_ingredients, onChange }: RecipeIngredientsEditorProps) {
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
    <section className="re_section_block" aria-label="Ingredients">
      <h2 className="re_section_title">Ingredients</h2>
      <div className="re_ing_list">
        {ingredients.map((ri, i) => {
          const ing = all_ingredients.find((a) => a.id === ri.ingredient_id);
          const name = ing?.name ?? ri.ingredient_id;
          return (
            <div key={ri.id} className="re_ing_row" role="group" aria-label={`Ingredient: ${name}`}>
              <span className="re_ing_name">{name}</span>
              <span className="re_ing_amount">
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
                  <span className="re_ing_amount_calc" title="Calculated from sections">
                    (calculated)
                    <button
                      type="button"
                      className="re_ing_add_amount"
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
                className="re_ing_remove"
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
        className="re_ing_add_select"
        value=""
        onChange={(e) => { addIngredient(e.target.value); e.target.value = ""; }}
        aria-label="Add ingredient to recipe"
      >
        <option value="">+ Add ingredient…</option>
        {all_ingredients
          .filter((ing) => !ingredients.some((ri) => ri.ingredient_id === ing.id))
          .map((ing) => (
            <option key={ing.id} value={ing.id}>{ing.name}</option>
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
      className="re_version_history"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="re_version_history_summary">
        Version history ({versions.length})
      </summary>
      <div className="re_version_history_body">
        <div className="re_version_filter" role="search" aria-label="Filter versions">
          {/* placeholder for filter bar */}
        </div>
        <table className="re_version_table">
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
                <td>{v.created_by}</td>
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
    <div className="re_dialog_overlay" role="dialog" aria-modal="true" aria-label="Copy recipe">
      <div className="re_dialog">
        <h2 className="re_dialog_title">Copy Recipe</h2>
        <label className="re_field_label">
          New title
          <input
            className="re_field_input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="New recipe title"
          />
        </label>
        <label className="re_field_label">
          Parent folder
          <select
            className="re_field_select"
            value={folder_id ?? ""}
            onChange={(e) => setFolderId(e.target.value ? (e.target.value as RecipeFolderId) : undefined)}
            aria-label="Parent folder for copy"
          >
            <option value="">— None —</option>
            {flatFolders.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </label>
        <div className="re_dialog_actions">
          <button type="button" onClick={() => onCopy(title, folder_id)} disabled={title.trim() === ""}>
            Copy
          </button>
          <button type="button" onClick={onCancel}>Cancel</button>
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

function makeInitialState(recipe: Recipe | null): EditorState {
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
  const v = latestVersion(recipe);
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

interface RecipeEditorProps {
  readonly recipe: Recipe | null;
  readonly userName: string;
  readonly onSave: (recipe: Recipe) => void;
  readonly onCancel: () => void;
}

function RecipeEditor({ recipe, userName, onSave, onCancel }: RecipeEditorProps) {
  const { create, save, copy } = useRecipeStore(userName);
  const { flatFolders, folders } = useRecipeFolderStore();
  const { ingredients: all_ingredients } = useIngredientStore();
  const [form, setForm] = useState<EditorState>(() => makeInitialState(recipe));
  const [showCopyDialog, setShowCopyDialog] = useState(false);

  const flat = flattenFolders(folders);

  function patch<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addTopIngredient(ingredient_id: IngredientItem["ingredient_id"]) {
    if (form.ingredients.some((ri) => ri.ingredient_id === ingredient_id)) return;
    setForm((f) => ({
      ...f,
      ingredients: [
        ...f.ingredients,
        { id: randomId(RecipeIngredientId), ingredient_id },
      ],
    }));
  }

  function handleSave() {
    const version_base: Omit<RecipeVersion, "id" | "recipe_id" | "created_at" | "created_by"> = {
      description: form.description,
      ingredients: form.ingredients,
      sections: form.sections,
    };

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
        created_by: v?.created_by ?? userName,
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
    void version_base;
  }

  function handleCopy(title: string, folder_id: RecipeFolderId | undefined) {
    if (recipe === null) return;
    const copied = copy(recipe.id, title, folder_id);
    setShowCopyDialog(false);
    onSave(copied);
  }

  return (
    <main className="re_editor" aria-label="Recipe editor">
      <div className="re_editor_header">
        <button type="button" className="re_back_btn" onClick={onCancel} aria-label="Back to recipe list">
          ← Back
        </button>
        <h1 className="re_editor_title">{recipe ? `Edit: ${recipe.title}` : "New Recipe"}</h1>
        {recipe && (
          <button type="button" className="re_copy_btn" onClick={() => setShowCopyDialog(true)}>
            Copy recipe
          </button>
        )}
      </div>

      {/* Recipe info */}
      <section className="re_section_block" aria-label="Recipe info">
        <h2 className="re_section_title">Recipe Info</h2>

        <label className="re_field_label">
          Source URL
          <input
            className="re_field_input"
            type="url"
            value={form.source_url}
            onChange={(e) => patch("source_url", e.target.value)}
            placeholder="Recipe Source URL"
            aria-label="Source URL"
          />
        </label>

        <label className="re_field_label">
          Title
          <input
            className="re_field_input re_field_input--title"
            value={form.title}
            onChange={(e) => patch("title", e.target.value)}
            placeholder="Recipe title"
            aria-label="Recipe title"
            required
          />
        </label>

        <label className="re_field_label">
          Subtitle
          <input
            className="re_field_input"
            value={form.subtitle}
            onChange={(e) => patch("subtitle", e.target.value)}
            placeholder="Subtitle"
            aria-label="Recipe subtitle"
          />
        </label>

        <label className="re_field_label">
          Version note
          <input
            className="re_field_input"
            value={form.description}
            onChange={(e) => patch("description", e.target.value)}
            placeholder='ex: "Untested" or "Final Version"'
            aria-label="Version description"
          />
        </label>

        <label className="re_field_label">
          Folder
          <select
            className="re_field_select"
            value={form.parent_folder_id ?? ""}
            onChange={(e) =>
              patch("parent_folder_id", e.target.value ? (e.target.value as RecipeFolderId) : undefined)
            }
            aria-label="Parent folder"
          >
            <option value="">— None —</option>
            {flat.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </label>
      </section>

      {/* Top-level ingredients */}
      <RecipeIngredientsEditor
        ingredients={form.ingredients}
        all_ingredients={all_ingredients}
        onChange={(ingredients) => patch("ingredients", ingredients)}
      />

      {/* Instruction sections */}
      <section className="re_section_block" aria-label="Instructions">
        <h2 className="re_section_title">Instructions</h2>
        {form.sections.map((sec, i) => (
          <SectionEditor
            key={sec.id}
            section={sec}
            depth={1}
            top_ingredients={form.ingredients}
            all_ingredients={all_ingredients}
            onChange={(updated) =>
              patch("sections", form.sections.map((s, j) => (j === i ? updated : s)))
            }
            onRemove={() => patch("sections", form.sections.filter((_, j) => j !== i))}
            onAddTopIngredient={addTopIngredient}
          />
        ))}
        <button
          type="button"
          className="re_add_section_btn"
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
      <section className="re_actions" aria-label="Save actions">
        {recipe && (
          <label className="re_new_version_label">
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
          className="re_save_btn"
          onClick={handleSave}
          disabled={form.title.trim() === ""}
          aria-label="Save recipe"
        >
          Save updates
        </button>
        <button type="button" className="re_cancel_btn" onClick={onCancel}>
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
    <main className="re_list_page" aria-label="Recipe list">
      <h1 className="re_list_title">Recipes</h1>
      <button type="button" className="re_new_btn" onClick={onNew} aria-label="New recipe">
        + New recipe
      </button>
      {recipes.length === 0 ? (
        <p className="re_list_empty">No recipes yet. Create your first one!</p>
      ) : (
        <ul className="re_list">
          {recipes.map((r) => {
            const v = latestVersion(r);
            return (
              <li key={r.id} className="re_list_item">
                <button
                  type="button"
                  className="re_list_item_btn"
                  onClick={() => onSelect(r)}
                  aria-label={`Edit recipe: ${r.title}`}
                >
                  <span className="re_list_item_title">{r.title}</span>
                  {r.subtitle && <span className="re_list_item_subtitle">{r.subtitle}</span>}
                  {v?.description && <span className="re_list_item_desc">{v.description}</span>}
                  <span className="re_list_item_date">
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

interface RecipeEditorPageProps {
  readonly userName: string;
}

type EditingState = { kind: "new" } | { kind: "edit"; recipe: Recipe } | null;

export function RecipeEditorPage({ userName }: RecipeEditorPageProps) {
  const { recipes } = useRecipeStore(userName);
  const [editing, setEditing] = useState<EditingState>(null);

  if (editing !== null) {
    return (
      <RecipeEditor
        recipe={editing.kind === "new" ? null : editing.recipe}
        userName={userName}
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
