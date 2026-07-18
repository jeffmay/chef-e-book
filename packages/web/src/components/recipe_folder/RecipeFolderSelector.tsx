import {
  type RecipeFolder,
  type RecipeFolderId,
  RecipeFolderId as RecipeFolderIdCompanion,
  loadId,
} from "@recipe-book/shared";
import type { TreeNode } from "primereact/treenode";
import { TreeSelect, type TreeSelectChangeEvent } from "primereact/treeselect";
import { useMemo, useState } from "react";
import "../../styles/treeSelect.css";
import "./RecipeFolderSelector.css";

function folderToNode(folder: RecipeFolder): TreeNode {
  return {
    key: folder.id,
    label: folder.name,
    children:
      folder.children && folder.children.length > 0 ? folder.children.map(folderToNode) : undefined,
  };
}

function buildPath(folders: RecipeFolder[], id: RecipeFolderId): string {
  function find(nodes: RecipeFolder[], target: string): string[] | null {
    for (const n of nodes) {
      if (n.id === target) return [n.name];
      if (n.children) {
        const sub = find(n.children, target);
        if (sub !== null) return [n.name, ...sub];
      }
    }
    return null;
  }
  return find(folders, id)?.join(" / ") ?? id;
}

export type RecipeFolderSelectorProps = {
  readonly value: RecipeFolderId | undefined;
  readonly folders: readonly RecipeFolder[];
  readonly onChange: (id: RecipeFolderId | undefined) => void;
  readonly onCreateFolder: (name: string, parent_id?: RecipeFolderId) => RecipeFolder;
  readonly ariaLabel?: string;
  readonly placeholder?: string;
};

export function RecipeFolderSelector({
  value,
  folders,
  onChange,
  onCreateFolder,
  ariaLabel = "Select folder",
  placeholder = "— No folder —",
}: RecipeFolderSelectorProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const treeNodes = useMemo(() => (folders as RecipeFolder[]).map(folderToNode), [folders]);
  const selectedPath = value !== undefined ? buildPath(folders as RecipeFolder[], value) : "";
  const nameError = adding && newName.trim() === "" ? "Subfolder name is required" : null;

  function handleChange(e: TreeSelectChangeEvent): void {
    const v = e.value;
    if (v === null || v === undefined || v === "") {
      onChange(undefined);
    } else if (typeof v === "string") {
      onChange(loadId(RecipeFolderIdCompanion, v));
    }
  }

  function cancelAdd() {
    setAdding(false);
    setNewName("");
  }

  function submitNewFolder() {
    const name = newName.trim();
    if (!name) return;
    const created = onCreateFolder(name, value);
    onChange(loadId(RecipeFolderIdCompanion, created.id));
    setNewName("");
    setAdding(false);
  }

  return (
    <div className="rfs-root">
      <div className="rfs-selector-row">
        <TreeSelect
          value={value ?? null}
          options={treeNodes}
          onChange={handleChange}
          selectionMode="single"
          filter
          placeholder={placeholder}
          className="tree-select rfs-selector"
          panelClassName="tree-select-panel"
          ariaLabel={ariaLabel}
          appendTo={document.body}
        />
        <label
          className="rfs-add-toggle"
          title={value !== undefined ? `Add subfolder under "${selectedPath}"` : "Add root folder"}
        >
          <input
            type="checkbox"
            checked={adding}
            onChange={(e) => {
              if (e.target.checked) setAdding(true);
              else cancelAdd();
            }}
            aria-label="Create new subfolder"
          />
          New subfolder
        </label>
      </div>
      {value !== undefined && (
        <span className="rfs-path" aria-label="Selected folder path">
          {selectedPath}
        </span>
      )}
      {adding && (
        <div className="rfs-add-row">
          <input
            className={`rfs-add-input${nameError !== null ? " field-input--error" : ""}`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNewFolder();
              if (e.key === "Escape") cancelAdd();
            }}
            placeholder="Subfolder name…"
            aria-label="New folder name"
            aria-describedby={nameError !== null ? "rfs-name-error" : undefined}
            autoFocus
          />
          <button
            type="button"
            onClick={submitNewFolder}
            disabled={nameError !== null}
            aria-label="Create folder"
          >
            ✓
          </button>
          <button type="button" onClick={cancelAdd} aria-label="Cancel new folder">
            ✕
          </button>
          {nameError !== null && (
            <span id="rfs-name-error" className="field-error" role="alert">
              {nameError}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
