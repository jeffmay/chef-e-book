import { type RecipeFolder, type RecipeFolderId } from "@recipe-book/shared";
import type { TreeNode } from "primereact/treenode";
import { TreeSelect, type TreeSelectChangeEvent } from "primereact/treeselect";
import { useMemo, useState } from "react";
import "./RecipeFolderSelector.css";

function folderToNode(folder: RecipeFolder): TreeNode {
  return {
    key: folder.id,
    label: folder.name,
    children: folder.children && folder.children.length > 0
      ? folder.children.map(folderToNode)
      : undefined,
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

export interface RecipeFolderSelectorProps {
  readonly value: RecipeFolderId | undefined;
  readonly folders: readonly RecipeFolder[];
  readonly onChange: (id: RecipeFolderId | undefined) => void;
  readonly onCreateFolder: (name: string, parent_id?: RecipeFolderId) => RecipeFolder;
  readonly ariaLabel?: string;
  readonly placeholder?: string;
}

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

  function handleChange(e: TreeSelectChangeEvent): void {
    const v = e.value;
    if (v === null || v === undefined || v === "") {
      onChange(undefined);
    } else if (typeof v === "string") {
      onChange(v as RecipeFolderId);
    }
  }

  function submitNewFolder() {
    const name = newName.trim();
    if (!name) return;
    const created = onCreateFolder(name, value);
    onChange(created.id as RecipeFolderId);
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
          className="rfs-selector"
          panelClassName="rfs-panel"
          ariaLabel={ariaLabel}
          appendTo="self"
        />
        <button
          type="button"
          className="rfs-add-btn"
          onClick={() => setAdding((v) => !v)}
          title={value !== undefined ? `Add subfolder under "${selectedPath}"` : "Add root folder"}
          aria-label="New subfolder"
        >
          + Folder
        </button>
      </div>
      {value !== undefined && (
        <span className="rfs-path" aria-label="Selected folder path">
          {selectedPath}
        </span>
      )}
      {adding && (
        <span className="rfs-add-row">
          <input
            className="rfs-add-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNewFolder();
              if (e.key === "Escape") { setAdding(false); setNewName(""); }
            }}
            placeholder="Folder name…"
            aria-label="New folder name"
            autoFocus
          />
          <button type="button" onClick={submitNewFolder} aria-label="Create folder">✓</button>
          <button type="button" onClick={() => { setAdding(false); setNewName(""); }} aria-label="Cancel new folder">✕</button>
        </span>
      )}
    </div>
  );
}
