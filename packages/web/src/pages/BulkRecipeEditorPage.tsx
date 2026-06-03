import type {
  Recipe,
  RecipeFolder,
  RecipeFolderId,
  RecipeId,
  RecipeVersion,
} from "@recipe-book/shared";
import { type FormEvent, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useRecipeFolderStore } from "../hooks/useRecipeFolderStore.ts";
import { latestVersion, useRecipeStore } from "../hooks/useRecipeStore.ts";
import "./BulkRecipeEditorPage.css";

// ---------------------------------------------------------------------------
// Tree row types
// ---------------------------------------------------------------------------

interface FolderRow {
  readonly kind: "folder";
  readonly folder: RecipeFolder;
  readonly depth: number;
}

interface RecipeRow {
  readonly kind: "recipe";
  readonly recipe: Recipe;
  readonly depth: number;
}

interface VersionRow {
  readonly kind: "version";
  readonly version: RecipeVersion;
  readonly recipeId: RecipeId;
  readonly depth: number;
}

type TreeRow = FolderRow | RecipeRow | VersionRow;

// ---------------------------------------------------------------------------
// Tree building
// ---------------------------------------------------------------------------

function sortLevelRecipes(recipes: Recipe[], sortOrder: string): Recipe[] {
  if (sortOrder === "alphabetical") {
    return [...recipes].sort((a, b) => a.title.localeCompare(b.title));
  }
  if (sortOrder === "created") {
    return [...recipes].sort((a, b) => b.created_at - a.created_at);
  }
  if (sortOrder === "update_at") {
    return [...recipes].sort((a, b) => b.updated_at - a.updated_at);
  }
  console.warn(`Unrecognized sortOrder for recipes: ${sortOrder}`);
  return recipes;
}

function buildRows(
  folders: RecipeFolder[],
  allRecipes: Recipe[],
  parentFolderId: RecipeFolderId | undefined,
  expandedFolders: ReadonlySet<RecipeFolderId>,
  expandedRecipes: ReadonlySet<RecipeId>,
  depth: number,
): TreeRow[] {
  const rows: TreeRow[] = [];

  for (const folder of folders) {
    rows.push({ kind: "folder", folder, depth });
    if (expandedFolders.has(folder.id)) {
      rows.push(
        ...buildRows(
          folder.children ?? [],
          allRecipes,
          folder.id,
          expandedFolders,
          expandedRecipes,
          depth + 1,
        ),
      );
    }
  }

  const levelRecipes = sortLevelRecipes(
    allRecipes.filter((r) => r.parent_folder_id === parentFolderId),
    "update_at",
  );

  for (const recipe of levelRecipes) {
    rows.push({ kind: "recipe", recipe, depth });
    if (expandedRecipes.has(recipe.id)) {
      const sorted = [...recipe.versions].reverse();
      for (const version of sorted) {
        rows.push({ kind: "version", version, recipeId: recipe.id, depth: depth + 1 });
      }
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BulkRecipeEditorPage() {
  const navigate = useNavigate();
  const { recipes, remove, merge } = useRecipeStore();
  const { folders } = useRecipeFolderStore();

  const [expandedFolders, setExpandedFolders] = useState<ReadonlySet<RecipeFolderId>>(new Set());
  const [expandedRecipes, setExpandedRecipes] = useState<ReadonlySet<RecipeId>>(new Set());
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<ReadonlySet<RecipeId>>(new Set());
  const [showMergeForm, setShowMergeForm] = useState(false);
  const [mergeName, setMergeName] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteBtnRef = useRef<HTMLButtonElement>(null);

  const visibleRows = buildRows(folders, recipes, undefined, expandedFolders, expandedRecipes, 0);

  const selectedArray = [...selectedRecipeIds];
  const someSelected = selectedArray.length > 0;
  const allSelected = recipes.length > 0 && recipes.every((r) => selectedRecipeIds.has(r.id));
  const someRecipesSelected = recipes.some((r) => selectedRecipeIds.has(r.id));

  function toggleFolder(id: RecipeFolderId): void {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleRecipeExpand(id: RecipeId): void {
    setExpandedRecipes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleRecipeSelect(id: RecipeId): void {
    setSelectedRecipeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(): void {
    if (allSelected) {
      setSelectedRecipeIds(new Set());
    } else {
      setSelectedRecipeIds(new Set(recipes.map((r) => r.id)));
    }
  }

  function clearSelection(): void {
    setSelectedRecipeIds(new Set());
    setShowMergeForm(false);
    setMergeName("");
  }

  function handleDeleteConfirm(): void {
    for (const id of selectedArray) remove(id);
    clearSelection();
    setShowDeleteConfirm(false);
  }

  function handleDeleteCancel(): void {
    setShowDeleteConfirm(false);
    deleteBtnRef.current?.focus();
  }

  function handleMergeSubmit(e: FormEvent): void {
    e.preventDefault();
    const name = mergeName.trim();
    if (name === "" || selectedArray.length < 2) return;
    merge(selectedArray, name);
    setMergeName("");
    setShowMergeForm(false);
    clearSelection();
  }

  function editRecipe(recipe: Recipe): void {
    const latest = latestVersion(recipe);
    if (latest !== undefined) {
      navigate(`/recipes/${recipe.id}/v/${latest.id}`);
    } else {
      navigate(`/recipes/${recipe.id}`);
    }
  }

  return (
    <main className="bre-page" aria-label="Recipes">
      <div className="bre-header">
        <h1 className="bre-title">Recipes</h1>
        <button
          type="button"
          className="bre-new-btn"
          onClick={() => navigate("/recipes/new")}
          aria-label="New recipe"
        >
          + New recipe
        </button>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="bre-bulk-bar" role="region" aria-label="Recipe bulk actions">
          <button type="button" className="bre-bulk-clear" onClick={clearSelection}>
            Clear
          </button>
          <span className="bre-bulk-count">{selectedArray.length} selected</span>
          <button
            ref={deleteBtnRef}
            type="button"
            className="bre-bulk-btn"
            onClick={() => setShowDeleteConfirm(true)}
            aria-label="Delete selected recipes"
          >
            Delete
          </button>
          {selectedArray.length >= 2 && (
            <>
              {showMergeForm ? (
                <form className="bre-merge-form" onSubmit={handleMergeSubmit}>
                  <input
                    type="text"
                    className="bre-merge-input"
                    value={mergeName}
                    onChange={(e) => setMergeName(e.target.value)}
                    placeholder="Merged recipe name…"
                    aria-label="Merged recipe name"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setShowMergeForm(false);
                        setMergeName("");
                      }
                    }}
                  />
                  <button
                    type="submit"
                    className="bre-bulk-btn"
                    disabled={mergeName.trim() === ""}
                    aria-label="Confirm merge"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    className="bre-bulk-btn"
                    onClick={() => {
                      setShowMergeForm(false);
                      setMergeName("");
                    }}
                    aria-label="Cancel merge"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className="bre-bulk-btn"
                  onClick={() => setShowMergeForm(true)}
                  aria-label="Merge selected recipes"
                >
                  Merge
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Delete confirm dialog */}
      {showDeleteConfirm && (
        <div
          className="bre-delete-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete recipes"
          tabIndex={-1}
          onClick={handleDeleteCancel}
          onKeyDown={(e) => {
            if (e.key === "Escape") handleDeleteCancel();
          }}
        >
          <div
            className="bre-delete-dialog"
            data-testid="bre-delete-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="bre-delete-title">
              Delete {selectedArray.length} recipe{selectedArray.length !== 1 ? "s" : ""}?
            </p>
            <p className="bre-delete-subtitle">This action cannot be undone.</p>
            <div className="bre-delete-actions">
              <button
                type="button"
                className="bre-delete-btn bre-delete-btn--cancel"
                onClick={handleDeleteCancel}
                autoFocus
                aria-label="Cancel delete"
              >
                ↩ Cancel
              </button>
              <button
                type="button"
                className="bre-delete-btn bre-delete-btn--accept"
                onClick={handleDeleteConfirm}
                aria-label="Confirm delete"
              >
                ✔︎ Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {visibleRows.length === 0 && !someSelected ? (
        <p className="bre-empty">No recipes yet. Create your first one!</p>
      ) : (
        <table className="bre-table" aria-label="Recipe list">
          <thead>
            <tr>
              <th className="bre-th bre-th--select">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someRecipesSelected && !allSelected;
                  }}
                  onChange={toggleAll}
                  aria-label="Select all recipes"
                />
              </th>
              <th className="bre-th bre-th--name">Name</th>
              <th className="bre-th bre-th--date">Created</th>
              <th className="bre-th bre-th--date">Updated</th>
              <th className="bre-th bre-th--actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              if (row.kind === "folder") {
                const { folder, depth } = row;
                const isExpanded = expandedFolders.has(folder.id);
                return (
                  <tr key={`folder-${folder.id}`} className="bre-row bre-row--folder">
                    <td className="bre-td bre-td--select" />
                    <td className="bre-td bre-td--name" data-depth={depth}>
                      <button
                        type="button"
                        className="bre-expand-btn"
                        onClick={() => toggleFolder(folder.id)}
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? "Collapse" : "Expand"} folder ${folder.name}`}
                      >
                        <span className="bre-expand-icon" aria-hidden>
                          {isExpanded ? "▼" : "▶"}
                        </span>
                      </button>
                      <span className="bre-folder-icon" aria-hidden>
                        📁
                      </span>
                      <span className="bre-name">{folder.name}</span>
                    </td>
                    <td className="bre-td bre-td--date">—</td>
                    <td className="bre-td bre-td--date">—</td>
                    <td className="bre-td bre-td--actions" />
                  </tr>
                );
              }

              if (row.kind === "recipe") {
                const { recipe, depth } = row;
                const isExpanded = expandedRecipes.has(recipe.id);
                const isSelected = selectedRecipeIds.has(recipe.id);
                const hasVersions = recipe.versions.length > 0;
                return (
                  <tr
                    key={`recipe-${recipe.id}`}
                    className={`bre-row bre-row--recipe${isSelected ? " bre-row--selected" : ""}`}
                  >
                    <td className="bre-td bre-td--select">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRecipeSelect(recipe.id)}
                        aria-label={`Select recipe ${recipe.title}`}
                      />
                    </td>
                    <td className="bre-td bre-td--name" data-depth={depth}>
                      {hasVersions ? (
                        <button
                          type="button"
                          className="bre-expand-btn"
                          onClick={() => toggleRecipeExpand(recipe.id)}
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? "Collapse" : "Expand"} versions of ${recipe.title}`}
                        >
                          <span className="bre-expand-icon" aria-hidden>
                            {isExpanded ? "▼" : "▶"}
                          </span>
                        </button>
                      ) : (
                        <span className="bre-expand-spacer" aria-hidden />
                      )}
                      <span className="bre-name">{recipe.title}</span>
                      {recipe.subtitle !== undefined && (
                        <span className="bre-subtitle">{recipe.subtitle}</span>
                      )}
                    </td>
                    <td className="bre-td bre-td--date">
                      {new Date(recipe.created_at).toLocaleDateString()}
                    </td>
                    <td className="bre-td bre-td--date">
                      {new Date(recipe.updated_at).toLocaleDateString()}
                    </td>
                    <td className="bre-td bre-td--actions">
                      <button
                        type="button"
                        className="bre-edit-btn"
                        onClick={() => editRecipe(recipe)}
                        aria-label={`Edit recipe ${recipe.title}`}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              }

              // version row
              const { version, recipeId, depth } = row;
              return (
                <tr key={`version-${version.id}`} className="bre-row bre-row--version">
                  <td className="bre-td bre-td--select" />
                  <td className="bre-td bre-td--name" data-depth={depth}>
                    <span className="bre-expand-spacer" aria-hidden />
                    <span className="bre-version-desc">
                      {version.description !== "" ? version.description : <em>Untitled version</em>}
                    </span>
                  </td>
                  <td className="bre-td bre-td--date">
                    {new Date(version.created_at).toLocaleDateString()}
                  </td>
                  <td className="bre-td bre-td--date">—</td>
                  <td className="bre-td bre-td--actions">
                    <button
                      type="button"
                      className="bre-edit-btn"
                      onClick={() => navigate(`/recipes/${recipeId}/v/${version.id}`)}
                      aria-label={`Edit version ${version.description || "Untitled version"}`}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
