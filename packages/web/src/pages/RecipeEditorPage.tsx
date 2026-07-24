import type { RecipeFolder } from "@recipe-book/shared";
import {
  collectIngredientItems,
  computeTopIngredients,
  loadId,
  randomId,
  type Recipe,
  RecipeFolderId,
  type RecipeVersion,
  RecipeVersionId,
  type Section,
} from "@recipe-book/shared";
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { ReadonlyDeep } from "type-fest";
import { ButtonMenu } from "../components/button_menu/ButtonMenu.tsx";
import { RecipeVersionEditor } from "../components/recipe_editor/RecipeVersionEditor.tsx";
import { RecipeFolderSelector } from "../components/recipe_folder/RecipeFolderSelector.tsx";
import { useRecipeFolderStore } from "../hooks/useRecipeFolderStore.ts";
import { latestVersion, useRecipeStore } from "../hooks/useRecipeStore.ts";
import { useStartSession } from "../hooks/useStartSession.ts";
import "./RecipeEditorPage.css";

// Re-exported for existing consumers/tests; the implementations moved to the
// shared package and the RecipeVersionEditor component.
export {
  computeAmountOrDefault,
  getByIdOrThrow,
  isSameMeasurementCategory,
  resolveAmountOnIngredientChange,
} from "../components/recipe_editor/RecipeVersionEditor.tsx";
export { computeTopIngredients };

// ---------------------------------------------------------------------------
// Helper: flatten folder tree for <select>
// ---------------------------------------------------------------------------

type FlatFolder = {
  readonly id: RecipeFolderId;
  readonly label: string;
};

function flattenFolders(folders: RecipeFolder[], depth = 0): FlatFolder[] {
  const result: FlatFolder[] = [];
  for (const f of folders) {
    result.push({ id: f.id, label: " ".repeat(depth * 2) + f.name });
    if (f.children !== undefined && f.children.length > 0) {
      result.push(...flattenFolders(f.children, depth + 1));
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// VersionHistoryTable
// ---------------------------------------------------------------------------

type VersionHistoryTableProps = ReadonlyDeep<{
  versions: RecipeVersion[];
  onStart: (version: ReadonlyDeep<RecipeVersion>) => void;
  onEdit: (version: ReadonlyDeep<RecipeVersion>) => void;
}>;

function VersionHistoryTable({ versions, onStart, onEdit }: VersionHistoryTableProps) {
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
              <th className="re-version-date">Date</th>
              <th>Description</th>
              <th className="re-version-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((v) => {
              const name = v.description || "Untitled version";
              return (
                <tr key={v.id}>
                  <td>{new Date(v.created_at).toLocaleDateString()}</td>
                  <td>{v.description || <em>—</em>}</td>
                  <td>
                    <ButtonMenu
                      defaultButton={{
                        label: "🖊️ Edit",
                        onSelect: () => onEdit(v),
                        ariaLabel: `Edit version ${name}`,
                      }}
                      buttons={[{ label: "▶ Start", onSelect: () => onStart(v) }]}
                      menuLabel={`More actions for version ${name}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// CopyRecipeDialog
// ---------------------------------------------------------------------------

type CopyRecipeDialogProps = ReadonlyDeep<{
  recipe: Recipe;
  flatFolders: { id: RecipeFolderId; label: string }[];
  onCopy: (title: string, folderId: RecipeFolderId | undefined) => void;
  onCancel: () => void;
}>;

function CopyRecipeDialog({ recipe, flatFolders, onCopy, onCancel }: CopyRecipeDialogProps) {
  const [title, setTitle] = useState(`${recipe.title} (copy)`);
  const [folderId, setFolderId] = useState<RecipeFolderId | undefined>(recipe.parent_folder_id);

  return (
    <div className="re-dialog-overlay" role="dialog" aria-modal="true" aria-label="Copy recipe">
      <div className="re-dialog">
        <h2 className="re-dialog-title">Copy Recipe</h2>
        <label className="re-field-label field-row">
          <span className="field-row-label">New title</span>
          <input
            className="re-field-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="New recipe title"
          />
        </label>
        <label className="re-field-label field-row">
          <span className="field-row-label">Parent folder</span>
          <select
            className="re-field-select"
            value={folderId ?? ""}
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
            onClick={() => onCopy(title, folderId)}
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

type EditorState = {
  title: string;
  subtitle: string;
  source_url: string;
  parent_folder_id: RecipeFolderId | undefined;
  version_description: string;
  sections: Section[];
  create_new_version: boolean;
};

function makeInitialState(
  recipe: ReadonlyDeep<Recipe> | null,
  versionId?: string,
  initialFolderId?: RecipeFolderId,
): ReadonlyDeep<EditorState> {
  if (recipe === null) {
    return {
      title: "",
      subtitle: "",
      source_url: "",
      parent_folder_id: initialFolderId,
      version_description: "",
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
    version_description: "",
    sections: v?.sections ?? [],
    create_new_version: false,
  };
}

// ---------------------------------------------------------------------------
// RecipeEditor
// ---------------------------------------------------------------------------

export type RecipeEditorProps = ReadonlyDeep<{
  recipe: Recipe | null;
  versionId?: string;
  initialFolderId?: RecipeFolderId;
  onSave: (recipe: Recipe) => void;
  onCancel: () => void;
}>;

export function RecipeEditor({
  recipe,
  versionId,
  initialFolderId,
  onSave,
  onCancel,
}: RecipeEditorProps) {
  const { create, save, copy } = useRecipeStore();
  const { folders, createFolder } = useRecipeFolderStore();
  const startSession = useStartSession();
  const navigate = useNavigate();
  const [form, setForm] = useState<ReadonlyDeep<EditorState>>(() =>
    makeInitialState(recipe, versionId, initialFolderId),
  );
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  // The recipe book doc loads asynchronously from IndexedDB, so on a hard
  // refresh `recipe` is null on first render and arrives a tick later. The
  // form is seeded once from `useState`, so re-seed it whenever the recipe (or
  // requested version) identity changes — otherwise the title and sections
  // would stay blank after the recipe finally loads.
  const editorKey = `${recipe?.id ?? ""}::${versionId ?? ""}`;
  const [loadedKey, setLoadedKey] = useState(editorKey);
  if (editorKey !== loadedKey) {
    setLoadedKey(editorKey);
    setForm(makeInitialState(recipe, versionId, initialFolderId));
  }

  const flat = flattenFolders(folders);

  // The version a started session runs: the one being viewed, or the latest.
  const displayedVersion =
    recipe === null
      ? undefined
      : versionId !== undefined
        ? (recipe.versions.find((v) => v.id === versionId) ?? latestVersion(recipe))
        : latestVersion(recipe);

  function patch<K extends keyof EditorState>(key: K, value: ReadonlyDeep<EditorState[K]>) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleToggleNewVersion(checked: boolean) {
    setForm((f) => ({
      ...f,
      create_new_version: checked,
      ...(checked && { version_description: "" }),
    }));
    if (checked) {
      // The field mounts on this state change, so defer focus until after it
      // is in the DOM.
      setTimeout(() => {
        descriptionInputRef.current?.focus();
      }, 0);
    }
  }

  function handleSave() {
    const computedIngredients = computeTopIngredients(form.sections);

    if (recipe === null) {
      const created = create({
        title: form.title,
        ...(form.subtitle && { subtitle: form.subtitle }),
        ...(form.source_url && { source_url: form.source_url }),
        ...(form.parent_folder_id !== undefined && { parent_folder_id: form.parent_folder_id }),
        description: form.version_description,
      });
      onSave(created);
    } else {
      const v = latestVersion(recipe);
      const version: ReadonlyDeep<RecipeVersion> = {
        id: (form.create_new_version && v?.id) || randomId(RecipeVersionId),
        recipe_id: recipe.id,
        description: form.version_description,
        ingredients: computedIngredients,
        sections: form.sections,
        // The editor has no UI for the time fields yet; carry them over so a
        // save doesn't wipe values set from a session summary.
        ...(v?.estimated_time_seconds !== undefined && {
          estimated_time_seconds: v.estimated_time_seconds,
        }),
        ...(v?.seconds_per_ingredient !== undefined && {
          seconds_per_ingredient: v.seconds_per_ingredient,
        }),
        created_at: (form.create_new_version && v?.created_at) || Date.now(),
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

  const missingAmountCount = useMemo(
    () => collectIngredientItems(form.sections).filter((i) => i.customAmount == null).length,
    [form.sections],
  );
  const titleError = form.title.trim() === "" ? "Title is required" : null;
  // A new recipe always creates its first version, so it requires a version
  // description. An existing recipe only needs one when the user opts to save a
  // new version (otherwise the edit updates the latest version in place).
  const showVersionDescription = recipe === null || form.create_new_version;
  const descriptionError =
    showVersionDescription && form.version_description.trim() === ""
      ? "Version description is required"
      : null;
  const canSave = titleError === null && descriptionError === null && missingAmountCount === 0;

  return (
    <main className="re-editor" aria-label="Recipe editor">
      <div className="re-editor-header">
        <button
          type="button"
          className="re-back-btn"
          onClick={onCancel}
          aria-label="Back to recipe list"
        >
          ⬅︎
        </button>
        <h1 className="re-editor-title">
          {form.title ? form.title : recipe ? "Edit" : "New Recipe"}
        </h1>
        {recipe && (
          <ButtonMenu
            className="re-header-actions"
            {...(displayedVersion !== undefined && {
              defaultButton: {
                label: "▶ Start",
                onSelect: () => startSession(recipe.id, displayedVersion.id),
                ariaLabel: `Start session for ${recipe.title}`,
              },
            })}
            buttons={[{ label: "Copy recipe", onSelect: () => setShowCopyDialog(true) }]}
            menuLabel={`More actions for ${recipe.title}`}
          />
        )}
      </div>

      {/* Recipe info */}
      <section className="re-section-block" aria-label="Recipe info">
        <h2 className="re-section-title">Recipe Info</h2>

        <label className="re-field-label field-row">
          <span className="field-row-label">
            Title
            <span className="field-required" aria-hidden="true">
              *
            </span>
          </span>
          <input
            id="recipe-title"
            className={`re-field-input${titleError !== null ? " field-input--error" : ""}`}
            value={form.title}
            onChange={(e) => patch("title", e.target.value)}
            aria-label="Recipe title"
            aria-describedby={titleError !== null ? "re-title-error" : undefined}
            required
          />
          {titleError !== null && (
            <span id="re-title-error" className="field-error" role="alert">
              {titleError}
            </span>
          )}
        </label>

        <label className="re-field-label field-row">
          <span className="field-row-label">Subtitle</span>
          <input
            className="re-field-input"
            value={form.subtitle}
            onChange={(e) => patch("subtitle", e.target.value)}
            aria-label="Recipe subtitle"
          />
        </label>

        <label className="re-field-label field-row">
          <span className="field-row-label">Source URL</span>
          <input
            className="re-field-input"
            type="url"
            value={form.source_url}
            onChange={(e) => patch("source_url", e.target.value)}
            aria-label="Source URL"
          />
        </label>

        {/* A plain <div>, not a <label>: RecipeFolderSelector is a composite
            widget (TreeSelect + a "New subfolder" checkbox). Wrapping it in a
            <label> makes pointer clicks forward to the label's control, which
            toggles the TreeSelect overlay open-then-closed so it never opens. */}
        <div className="re-field-label field-row">
          <span className="field-row-label">Folder</span>
          <RecipeFolderSelector
            value={form.parent_folder_id}
            folders={folders}
            onChange={(id) => patch("parent_folder_id", id)}
            onCreateFolder={(name, parentId) => createFolder(name, parentId)}
            ariaLabel="Parent folder"
          />
        </div>
      </section>

      {/* Computed ingredients + instruction sections */}
      <RecipeVersionEditor
        sections={form.sections}
        onChange={(sections) => patch("sections", sections)}
      />

      {/* Version history */}
      {recipe && (
        <VersionHistoryTable
          versions={recipe.versions}
          onStart={(v) => startSession(recipe.id, v.id)}
          onEdit={(v) => navigate(`/recipes/${recipe.id}/v/${v.id}`)}
        />
      )}

      {/* Save actions */}
      <section className="re-actions">
        <div className="re-version-options">
          {recipe !== null && (
            <label className="re-new-version-label">
              <input
                type="checkbox"
                checked={form.create_new_version}
                onChange={(e) => handleToggleNewVersion(e.target.checked)}
                aria-label="Create a new version from changes"
              />
              Create new version
            </label>
          )}
          {showVersionDescription && (
            <label
              className="re-version-description-label field-row"
              htmlFor="re-version-description-input"
            >
              <span className="field-row-label">
                Version description
                <span className="field-required" aria-hidden="true">
                  *
                </span>
              </span>
              <input
                id="re-version-description-input"
                ref={descriptionInputRef}
                className={descriptionError !== null ? "field-input--error" : ""}
                value={form.version_description}
                onChange={(e) => patch("version_description", e.target.value)}
                aria-label="Version description"
                aria-describedby={descriptionError !== null ? "re-description-error" : undefined}
                required
              />
              {descriptionError !== null && (
                <span id="re-description-error" className="field-error" role="alert">
                  {descriptionError}
                </span>
              )}
            </label>
          )}
        </div>
        {missingAmountCount > 0 && (
          <p className="field-error" role="alert">
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
          flatFolders={flat}
          onCopy={handleCopy}
          onCancel={() => setShowCopyDialog(false)}
        />
      )}
    </main>
  );
}
