import type {
  Recipe,
  RecipeFolder,
  RecipeFolderId,
  RecipeId,
  RecipeVersion,
} from "@recipe-book/shared";
import { Fragment, type FormEvent, useRef, useState } from "react";
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
// New-menu target — root or a specific folder
// ---------------------------------------------------------------------------

type NewMenuTarget =
  | { readonly kind: "root" }
  | { readonly kind: "folder"; readonly folderId: RecipeFolderId };

// ---------------------------------------------------------------------------
// Tree building
// ---------------------------------------------------------------------------

function sortLevelRecipes(recipes: Recipe[]): Recipe[] {
  return [...recipes].sort((a, b) => b.updated_at - a.updated_at);
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
  const { recipes, removeAll, merge } = useRecipeStore();
  const { folders, createFolder } = useRecipeFolderStore();

  const [rootExpanded, setRootExpanded] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<ReadonlySet<RecipeFolderId>>(new Set());
  const [expandedRecipes, setExpandedRecipes] = useState<ReadonlySet<RecipeId>>(new Set());
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<ReadonlySet<RecipeId>>(new Set());
  const [showMergeForm, setShowMergeForm] = useState(false);
  const [mergeName, setMergeName] = useState("");
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Which folder's New ▾ menu is open. null = none.
  const [newMenuTarget, setNewMenuTarget] = useState<NewMenuTarget | null>(null);

  // Inline folder-creation parent: null = not creating, undefined = root level, RecipeFolderId = that folder.
  const [creatingFolderParentId, setCreatingFolderParentId] = useState<
    RecipeFolderId | undefined | null
  >(null);
  const [newFolderName, setNewFolderName] = useState("");

  const deleteBtnRef = useRef<HTMLButtonElement>(null);

  // Rows start at depth 1; depth 0 is reserved for the virtual root "Recipes" row.
  const visibleRows = buildRows(folders, recipes, undefined, expandedFolders, expandedRecipes, 1);

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
    setMergeError(null);
  }

  function handleDeleteConfirm(): void {
    removeAll(selectedArray);
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
    try {
      merge(selectedArray, name);
      setMergeName("");
      setShowMergeForm(false);
      clearSelection();
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : "Merge failed. Please try again.");
    }
  }

  function editRecipe(recipe: Recipe): void {
    const latest = latestVersion(recipe);
    if (latest !== undefined) {
      navigate(`/recipes/${recipe.id}/v/${latest.id}`);
    } else {
      navigate(`/recipes/${recipe.id}`);
    }
  }

  // ---------------------------------------------------------------------------
  // New-menu helpers
  // ---------------------------------------------------------------------------

  function handleNewRecipe(parentFolderId: RecipeFolderId | undefined): void {
    setNewMenuTarget(null);
    if (parentFolderId !== undefined) {
      navigate("/recipes/new", { state: { parentFolderId } });
    } else {
      navigate("/recipes/new");
    }
  }

  function handleStartNewFolder(parentId: RecipeFolderId | undefined): void {
    setNewMenuTarget(null);
    // undefined → creating at root; RecipeFolderId → creating under that folder
    setCreatingFolderParentId(parentId);
    setNewFolderName("");
  }

  function handleNewFolderSubmit(e: FormEvent): void {
    e.preventDefault();
    const name = newFolderName.trim();
    if (name === "") return;
    createFolder(name, creatingFolderParentId ?? undefined);
    setCreatingFolderParentId(null);
    setNewFolderName("");
  }

  function handleNewFolderCancel(): void {
    setCreatingFolderParentId(null);
    setNewFolderName("");
  }

  // Shared inline folder-creation row, rendered after the relevant folder row.
  function renderNewFolderRow(depth: number) {
    return (
      <tr className="bre-row bre-row--new-folder">
        <td className="bre-td bre-td--select" />
        <td className="bre-td bre-td--name" data-depth={depth}>
          <form className="bre-new-folder-form" onSubmit={handleNewFolderSubmit}>
            <input
              type="text"
              className="bre-new-folder-input"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name…"
              aria-label="New folder name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") handleNewFolderCancel();
              }}
            />
            <button
              type="submit"
              className="bre-new-folder-confirm"
              disabled={newFolderName.trim() === ""}
              aria-label="Confirm new folder"
            >
              ✔︎
            </button>
            <button
              type="button"
              className="bre-new-folder-cancel"
              onClick={handleNewFolderCancel}
              aria-label="Cancel new folder"
            >
              ↩
            </button>
          </form>
        </td>
        <td className="bre-td bre-td--date" />
        <td className="bre-td bre-td--date" />
        <td className="bre-td bre-td--actions" />
      </tr>
    );
  }

  // creatingFolderParentId === undefined means "form is open at root level"
  const isCreatingAtRoot = creatingFolderParentId === undefined;

  return (
    <main className="bre-page" aria-label="Recipes">
      {/* Transparent overlay to close the New menu when clicking outside */}
      {newMenuTarget !== null && (
        <div
          className="bre-new-menu-overlay"
          onClick={() => setNewMenuTarget(null)}
          aria-hidden="true"
        />
      )}

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
                    onChange={(e) => {
                      setMergeName(e.target.value);
                      setMergeError(null);
                    }}
                    placeholder="Merged recipe name…"
                    aria-label="Merged recipe name"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setShowMergeForm(false);
                        setMergeName("");
                        setMergeError(null);
                      }
                    }}
                  />
                  {mergeError !== null && (
                    <span className="bre-merge-error" role="alert">
                      {mergeError}
                    </span>
                  )}
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
                      setMergeError(null);
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

      {/* Table — always rendered; empty state lives inside tbody */}
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
          {/* Virtual root "Recipes" folder row (depth 0) */}
          <tr className="bre-row bre-row--folder bre-row--root">
            <td className="bre-td bre-td--select" />
            <td className="bre-td bre-td--name" data-depth={0}>
              <button
                type="button"
                className="bre-expand-btn"
                onClick={() => setRootExpanded((v) => !v)}
                aria-expanded={rootExpanded}
                aria-label={`${rootExpanded ? "Collapse" : "Expand"} Recipes folder`}
              >
                <span className="bre-expand-icon" aria-hidden>
                  {rootExpanded ? "▼" : "▶"}
                </span>
              </button>
              <span className="bre-folder-icon" aria-hidden>
                📁
              </span>
              <span className="bre-name">Recipes</span>
            </td>
            <td className="bre-td bre-td--date">—</td>
            <td className="bre-td bre-td--date">—</td>
            <td className="bre-td bre-td--actions">
              <div className="bre-new-menu-wrap">
                <button
                  type="button"
                  className="bre-new-menu-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setNewMenuTarget((prev) => (prev?.kind === "root" ? null : { kind: "root" }));
                  }}
                  aria-label="New item in Recipes"
                  aria-haspopup="true"
                  aria-expanded={newMenuTarget?.kind === "root"}
                >
                  New ▾
                </button>
                {newMenuTarget?.kind === "root" && (
                  <div className="bre-new-menu-dropdown" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className="bre-new-menu-item"
                      onClick={() => handleNewRecipe(undefined)}
                    >
                      Recipe
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="bre-new-menu-item"
                      onClick={() => handleStartNewFolder(undefined)}
                    >
                      Folder
                    </button>
                  </div>
                )}
              </div>
            </td>
          </tr>

          {/* Inline folder-creation row at root level (depth 1) */}
          {isCreatingAtRoot && renderNewFolderRow(1)}

          {/* Content rows — shown only when root is expanded */}
          {rootExpanded &&
            (visibleRows.length === 0 ? (
              <tr className="bre-row bre-row--empty">
                <td className="bre-td" colSpan={5}>
                  <p className="bre-empty">No recipes yet. Create your first one!</p>
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                if (row.kind === "folder") {
                  const { folder, depth } = row;
                  const isExpanded = expandedFolders.has(folder.id);
                  const isCreatingHere = creatingFolderParentId === folder.id;
                  const isMenuOpen =
                    newMenuTarget?.kind === "folder" && newMenuTarget.folderId === folder.id;
                  return (
                    <Fragment key={`folder-${folder.id}`}>
                      <tr className="bre-row bre-row--folder">
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
                        <td className="bre-td bre-td--actions">
                          <div className="bre-new-menu-wrap">
                            <button
                              type="button"
                              className="bre-new-menu-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setNewMenuTarget((prev) =>
                                  prev?.kind === "folder" && prev.folderId === folder.id
                                    ? null
                                    : { kind: "folder", folderId: folder.id },
                                );
                              }}
                              aria-label={`New item in folder ${folder.name}`}
                              aria-haspopup="true"
                              aria-expanded={isMenuOpen}
                            >
                              New ▾
                            </button>
                            {isMenuOpen && (
                              <div className="bre-new-menu-dropdown" role="menu">
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="bre-new-menu-item"
                                  onClick={() => handleNewRecipe(folder.id)}
                                >
                                  Recipe
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="bre-new-menu-item"
                                  onClick={() => handleStartNewFolder(folder.id)}
                                >
                                  Folder
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isCreatingHere && renderNewFolderRow(depth + 1)}
                    </Fragment>
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
                        {version.description !== "" ? (
                          version.description
                        ) : (
                          <em>Untitled version</em>
                        )}
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
              })
            ))}
        </tbody>
      </table>
    </main>
  );
}
