import type {
  Recipe,
  RecipeFolder,
  RecipeFolderId,
  RecipeId,
  RecipeVersion,
} from "@recipe-book/shared";
import {
  Fragment,
  type FormEvent,
  type KeyboardEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
// CreatingFolderState — discriminated union replacing the null/undefined sentinel
// ---------------------------------------------------------------------------

type CreatingFolderState =
  | { readonly kind: "idle" }
  | { readonly kind: "creating"; readonly parentId: RecipeFolderId | undefined };

const FOLDER_IDLE: CreatingFolderState = { kind: "idle" };

// ---------------------------------------------------------------------------
// EditingFolderState — inline rename state for existing folders
// ---------------------------------------------------------------------------

type EditingFolderState =
  | { readonly kind: "idle" }
  | { readonly kind: "editing"; readonly folderId: RecipeFolderId; readonly name: string };

const FOLDER_EDIT_IDLE: EditingFolderState = { kind: "idle" };

// ---------------------------------------------------------------------------
// NewFolderRow
// ---------------------------------------------------------------------------

interface NewFolderRowProps {
  readonly depth: number;
  readonly name: string;
  readonly onNameChange: (name: string) => void;
  readonly onSubmit: (e: FormEvent) => void;
  readonly onCancel: () => void;
}

function NewFolderRow({ depth, name, onNameChange, onSubmit, onCancel }: NewFolderRowProps) {
  return (
    <tr className="bre-row bre-row--new-folder">
      <td className="bre-td bre-td--select" />
      <td className="bre-td bre-td--name" data-depth={depth}>
        <div className="bre-td-name-inner">
          <form className="bre-new-folder-form" onSubmit={onSubmit}>
            <input
              type="text"
              className="bre-new-folder-input"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              aria-label="New folder name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") onCancel();
              }}
            />
            <button
              type="submit"
              className="bre-new-folder-confirm"
              disabled={name.trim() === ""}
              aria-label="Confirm new folder"
            >
              ✔︎
            </button>
            <button
              type="button"
              className="bre-new-folder-cancel"
              onClick={onCancel}
              aria-label="Cancel new folder"
            >
              ↩
            </button>
          </form>
        </div>
      </td>
      <td className="bre-td bre-td--date" />
      <td className="bre-td bre-td--date" />
      <td className="bre-td bre-td--actions" />
    </tr>
  );
}

// ---------------------------------------------------------------------------
// NewItemMenuDropdown — shared dropdown with keyboard navigation
// ---------------------------------------------------------------------------

interface NewItemMenuDropdownProps {
  readonly onRecipe: () => void;
  readonly onFolder: () => void;
  readonly onClose: () => void;
}

function NewItemMenuDropdown({ onRecipe, onFolder, onClose }: NewItemMenuDropdownProps) {
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
    );
    const idx = items.findIndex((item) => item === document.activeElement);

    if (e.key === "Escape") {
      e.stopPropagation();
      const btn = e.currentTarget
        .closest<HTMLElement>(".bre-new-menu-wrap")
        ?.querySelector<HTMLButtonElement>(".bre-new-menu-btn");
      onClose();
      btn?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      // When nothing is focused yet, start at the first item.
      items[idx === -1 ? 0 : (idx + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      // When nothing is focused yet, start at the last item.
      items[idx === -1 ? items.length - 1 : (idx - 1 + items.length) % items.length]?.focus();
    }
  }

  return (
    <div className="bre-new-menu-dropdown" role="menu" onKeyDown={handleKeyDown}>
      <button
        type="button"
        role="menuitem"
        className="bre-new-menu-item"
        onClick={onRecipe}
        autoFocus
      >
        Recipe
      </button>
      <button type="button" role="menuitem" className="bre-new-menu-item" onClick={onFolder}>
        Folder
      </button>
    </div>
  );
}

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
  const { folders, createFolder, updateFolder } = useRecipeFolderStore();

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

  // Inline folder-creation state.
  const [creatingFolder, setCreatingFolder] = useState<CreatingFolderState>(FOLDER_IDLE);
  const [newFolderName, setNewFolderName] = useState("");

  // Inline folder-rename state.
  const [editingFolder, setEditingFolder] = useState<EditingFolderState>(FOLDER_EDIT_IDLE);

  const deleteBtnRef = useRef<HTMLButtonElement>(null);

  // Keyed by folder id — lets us restore focus to a specific name span after rename.
  const folderNameRefs = useRef<Map<string, HTMLElement | null>>(new Map());
  // Set before calling setEditingFolder(idle); cleared by useLayoutEffect after the render.
  const pendingFocusFolderRef = useRef<string | undefined>(undefined);

  useLayoutEffect(() => {
    if (pendingFocusFolderRef.current !== undefined) {
      folderNameRefs.current.get(pendingFocusFolderRef.current)?.focus();
      pendingFocusFolderRef.current = undefined;
    }
  });

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
    setCreatingFolder({ kind: "creating", parentId });
    setNewFolderName("");
  }

  function handleNewFolderSubmit(e: FormEvent): void {
    e.preventDefault();
    const name = newFolderName.trim();
    if (name === "" || creatingFolder.kind !== "creating") return;
    createFolder(name, creatingFolder.parentId);
    setCreatingFolder(FOLDER_IDLE);
    setNewFolderName("");
  }

  function handleNewFolderCancel(): void {
    setCreatingFolder(FOLDER_IDLE);
    setNewFolderName("");
  }

  // ---------------------------------------------------------------------------
  // Rename-folder helpers
  // ---------------------------------------------------------------------------

  function handleStartRenameFolder(folder: RecipeFolder): void {
    setEditingFolder({ kind: "editing", folderId: folder.id, name: folder.name });
  }

  function handleRenameFolderSubmit(e: FormEvent, folder: RecipeFolder): void {
    e.preventDefault();
    if (editingFolder.kind !== "editing") return;
    const name = editingFolder.name.trim();
    if (name === "") return;
    updateFolder({ ...folder, name });
    pendingFocusFolderRef.current = editingFolder.folderId;
    setEditingFolder(FOLDER_EDIT_IDLE);
  }

  // restoreFocus=true for explicit keyboard/button cancel; false for blur-triggered cancel
  // (where focus has already moved to the element the user clicked).
  function handleRenameFolderCancel(restoreFocus = true): void {
    if (restoreFocus && editingFolder.kind === "editing") {
      pendingFocusFolderRef.current = editingFolder.folderId;
    }
    setEditingFolder(FOLDER_EDIT_IDLE);
  }

  const isCreatingAtRoot =
    creatingFolder.kind === "creating" && creatingFolder.parentId === undefined;

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
              <div className="bre-td-name-inner">
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
              </div>
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
                  <NewItemMenuDropdown
                    onRecipe={() => handleNewRecipe(undefined)}
                    onFolder={() => handleStartNewFolder(undefined)}
                    onClose={() => setNewMenuTarget(null)}
                  />
                )}
              </div>
            </td>
          </tr>

          {/* Inline folder-creation row at root level (depth 1) */}
          {isCreatingAtRoot && (
            <NewFolderRow
              depth={1}
              name={newFolderName}
              onNameChange={setNewFolderName}
              onSubmit={handleNewFolderSubmit}
              onCancel={handleNewFolderCancel}
            />
          )}

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
                  const isCreatingHere =
                    creatingFolder.kind === "creating" && creatingFolder.parentId === folder.id;
                  const isMenuOpen =
                    newMenuTarget?.kind === "folder" && newMenuTarget.folderId === folder.id;
                  return (
                    <Fragment key={`folder-${folder.id}`}>
                      <tr className="bre-row bre-row--folder">
                        <td className="bre-td bre-td--select" />
                        <td className="bre-td bre-td--name" data-depth={depth}>
                          <div className="bre-td-name-inner">
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
                            {editingFolder.kind === "editing" &&
                            editingFolder.folderId === folder.id ? (
                              <form
                                className="bre-rename-folder-form"
                                onSubmit={(e) => handleRenameFolderSubmit(e, folder)}
                                onBlur={(e) => {
                                  const related = e.relatedTarget;
                                  if (
                                    !(related instanceof Node) ||
                                    !e.currentTarget.contains(related)
                                  ) {
                                    handleRenameFolderCancel(false);
                                  }
                                }}
                              >
                                <input
                                  type="text"
                                  className="bre-rename-folder-input"
                                  value={editingFolder.name}
                                  onChange={(e) =>
                                    setEditingFolder({
                                      kind: "editing",
                                      folderId: folder.id,
                                      name: e.target.value,
                                    })
                                  }
                                  aria-label={`Rename folder ${folder.name}`}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Escape") handleRenameFolderCancel();
                                  }}
                                />
                                <button
                                  type="button"
                                  className="bre-rename-folder-cancel"
                                  onClick={() => handleRenameFolderCancel()}
                                  aria-label="Cancel rename folder"
                                >
                                  ↩
                                </button>
                                <button
                                  type="submit"
                                  className="bre-rename-folder-confirm"
                                  disabled={editingFolder.name.trim() === ""}
                                  aria-label="Confirm rename folder"
                                >
                                  ✔︎
                                </button>
                              </form>
                            ) : (
                              <span
                                className="bre-name bre-name--editable"
                                tabIndex={0}
                                title="Double-click or press Enter to rename"
                                ref={(el) => {
                                  if (el) folderNameRefs.current.set(folder.id, el);
                                  else folderNameRefs.current.delete(folder.id);
                                }}
                                onDoubleClick={() => handleStartRenameFolder(folder)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === "F2") {
                                    e.preventDefault();
                                    handleStartRenameFolder(folder);
                                  }
                                }}
                              >
                                {folder.name}
                              </span>
                            )}
                          </div>
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
                              <NewItemMenuDropdown
                                onRecipe={() => handleNewRecipe(folder.id)}
                                onFolder={() => handleStartNewFolder(folder.id)}
                                onClose={() => setNewMenuTarget(null)}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                      {isCreatingHere && (
                        <NewFolderRow
                          depth={depth + 1}
                          name={newFolderName}
                          onNameChange={setNewFolderName}
                          onSubmit={handleNewFolderSubmit}
                          onCancel={handleNewFolderCancel}
                        />
                      )}
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
                        <div className="bre-td-name-inner">
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
                        </div>
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
                      <div className="bre-td-name-inner">
                        <span className="bre-expand-spacer" aria-hidden />
                        <span className="bre-version-desc">
                          {version.description !== "" ? (
                            version.description
                          ) : (
                            <em>Untitled version</em>
                          )}
                        </span>
                      </div>
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
