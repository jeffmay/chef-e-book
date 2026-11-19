import {
  buildIngredientExport,
  buildRecipeExport,
  type ExportSource,
  type FolderMode,
  type ImportOptions,
  type ImportPlan,
  type ImportRow,
  IngredientId,
  isEmptyImportPlan,
  loadId,
  planImportIntoDoc,
  type RecipeBookExport,
  RecipeFolderId,
  RecipeId,
  type RecipeMatchAction,
  readImportFile,
  restrictBundleToIngredients,
  summarizeImportPlan,
  getBookMeta,
  getRecipeFoldersFlat,
} from "@recipe-book/shared";
import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import type { ReadonlyDeep } from "type-fest";
import { useBookDoc } from "../../contexts/docContext.ts";
import { useOptionalBookUndo } from "../../contexts/undoContext.ts";
import { useBookImport } from "../../hooks/useBookImport.ts";
import {
  type BookRegistryEntry,
  readBookRegistry,
  sortBooksByRecent,
} from "../../storage/bookRegistry.ts";
import { loadBookSource } from "../../storage/bookSource.ts";
import { Modal } from "../modal/Modal.tsx";
import { folderOptions } from "./folderOptions.ts";
import "./ImportModal.css";

export type ImportScope = "recipes" | "ingredients";

export type ImportModalProps = ReadonlyDeep<{
  /** What the page it was opened from works with: recipes (and what they need), or ingredients. */
  scope: ImportScope;
  onClose: () => void;
}>;

type Step = "source" | "scope" | "options" | "preview" | "done";

type Chosen = {
  /** What the data is called in a version description: a file name, or a book name. */
  label: string;
  /** Set for a book on this device, whose contents the person narrows down; null for a file. */
  source: ExportSource | null;
  /** Set for a file, which is imported whole; null until a device book's scope is chosen. */
  bundle: RecipeBookExport | null;
};

const MATCH_ACTIONS: readonly RecipeMatchAction[] = ["merge_version", "keep_both", "skip"];

const ACTION_TEXT: Record<RecipeMatchAction, string> = {
  merge_version: "Add as a new version",
  keep_both: "Keep both",
  skip: "Skip",
};

function actionText(row: ReadonlyDeep<ImportRow>): string {
  switch (row.action) {
    case "create":
      return "New";
    case "reuse":
      return "Already in the book";
    case "new_version":
      return "New version";
    case "unchanged":
      return "Already up to date";
    case "skip":
      return "Skipped";
  }
}

/**
 * Brings recipes (with the ingredients they need) or ingredients into the open book, from an export
 * file or from another book on this device, in five steps: where from, what to bring (a device
 * book only), where to put it (recipes only), a preview with a choice for each recipe the book
 * already has, and the result. The preview is a real plan made against the book as it is, and the
 * import itself is one undo step.
 */
export function ImportModal({ scope, onClose }: ImportModalProps) {
  const { doc } = useBookDoc();
  const bookUndo = useOptionalBookUndo();
  const { importNow } = useBookImport();

  const [step, setStep] = useState<Step>("source");
  const [sourceKind, setSourceKind] = useState<"file" | "book">("file");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [bundle, setBundle] = useState<RecipeBookExport | null>(null);
  const [folderId, setFolderId] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [folderMode, setFolderMode] = useState<FolderMode>("retain");
  const [onMatch, setOnMatch] = useState<RecipeMatchAction>("merge_version");
  const [recipeActions, setRecipeActions] = useState<Readonly<Record<string, RecipeMatchAction>>>(
    {},
  );
  const [applied, setApplied] = useState<ImportPlan | null>(null);

  const books = useMemo<BookRegistryEntry[]>(() => {
    const activeId = getBookMeta(doc)?.id;
    return sortBooksByRecent(readBookRegistry().registry.books).filter((b) => b.id !== activeId);
  }, [doc]);
  const folders = useMemo(() => folderOptions(getRecipeFoldersFlat(doc)), [doc]);

  /** The options as chosen so far, stamped with the moment they are asked for. */
  const optionsAt = useCallback(
    (now: number): ImportOptions => ({
      folder_mode: folderMode,
      on_match: onMatch,
      recipe_actions: recipeActions,
      source_label: chosen?.label ?? "an import",
      now,
      ...(folderId !== "" && { target_folder_id: loadId(RecipeFolderId, folderId) }),
      ...(newFolderName.trim() !== "" && { new_folder_name: newFolderName.trim() }),
    }),
    [folderMode, onMatch, recipeActions, chosen, folderId, newFolderName],
  );
  const plan = useMemo<ImportPlan | null>(
    () =>
      step === "preview" && bundle !== null
        ? planImportIntoDoc(doc, bundle, optionsAt(Date.now()))
        : null,
    [step, bundle, doc, optionsAt],
  );

  function close(): boolean {
    onClose();
    return true;
  }

  // ----- step: source -----------------------------------------------------------------------
  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file === undefined) return;
    setError(null);
    const result = readImportFile(await file.text(), file.size);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    acceptBundle(result.bundle, { label: file.name, source: null, bundle: result.bundle });
  }

  async function handleBook(book: ReadonlyDeep<BookRegistryEntry>) {
    setError(null);
    setLoading(true);
    try {
      const source = await loadBookSource(book.id);
      setChosen({ label: book.name, source, bundle: null });
      setPicked(new Set());
      setStep("scope");
    } catch (e) {
      setError(`Could not open "${book.name}": ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  /** A whole export (a file) is ready: narrow it to the scope and go on. */
  function acceptBundle(whole: RecipeBookExport, next: Chosen) {
    if (scope === "ingredients") {
      const only = restrictBundleToIngredients(whole);
      if (only.ingredients.length === 0) {
        setError("This file has no ingredients to import.");
        return;
      }
      setBundle(only);
      setChosen(next);
      setStep("preview");
      return;
    }
    setBundle(whole);
    setChosen(next);
    setStep("options");
  }

  // ----- step: scope (device book) ----------------------------------------------------------
  const items = useMemo(() => {
    const source = chosen?.source;
    if (source === null || source === undefined) return [];
    if (scope === "ingredients") {
      return source.ingredients.map((i) => ({ id: String(i.id), label: i.name }));
    }
    const paths = new Map(folderOptions(source.recipe_folders).map((f) => [String(f.id), f.path]));
    return source.recipes
      .map((r) => {
        const path = r.parent_folder_id === undefined ? undefined : paths.get(r.parent_folder_id);
        return { id: String(r.id), label: path === undefined ? r.title : `${path} / ${r.title}` };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [chosen, scope]);

  function togglePicked(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function continueFromScope() {
    const source = chosen?.source;
    if (source === null || source === undefined) return;
    const info = { exported_at: Date.now() };
    const made =
      scope === "ingredients"
        ? buildIngredientExport(
            source,
            [...picked].map((id) => loadId(IngredientId, id)),
            info,
          )
        : buildRecipeExport(
            source,
            [...picked].map((id) => loadId(RecipeId, id)),
            info,
          );
    setBundle(made);
    setStep(scope === "ingredients" ? "preview" : "options");
  }

  // ----- step: preview -> done --------------------------------------------------------------
  function runImport() {
    if (bundle === null) return;
    const result = importNow(bundle, optionsAt(Date.now()), bookUndo);
    setApplied(result);
    setStep("done");
  }

  // ----- rendering --------------------------------------------------------------------------
  const title = scope === "recipes" ? "Import recipes" : "Import ingredients";

  if (step === "source") {
    return (
      <Modal
        title={title}
        onClose={close}
        buttons={{ cancel: { text: "Cancel", dangerous: false, onClick: close } }}
      >
        <div className="im-body">
          <fieldset className="im-fieldset">
            <legend>Where from?</legend>
            <label className="im-choice">
              <input
                type="radio"
                name="import-source"
                checked={sourceKind === "file"}
                onChange={() => setSourceKind("file")}
              />
              From an export file
            </label>
            <label className="im-choice">
              <input
                type="radio"
                name="import-source"
                checked={sourceKind === "book"}
                onChange={() => setSourceKind("book")}
              />
              From another book on this device
            </label>
          </fieldset>

          {sourceKind === "file" ? (
            <div className="im-field">
              <label htmlFor="import-file">Export file</label>
              <input
                id="import-file"
                type="file"
                accept=".json,application/json"
                aria-label="Export file"
                onChange={(e) => void handleFile(e)}
              />
            </div>
          ) : books.length === 0 ? (
            <p>There are no other books on this device.</p>
          ) : (
            <ul className="im-list" aria-label="Books on this device">
              {books.map((book) => (
                <li key={book.id}>
                  <button
                    type="button"
                    className="im-book"
                    disabled={loading}
                    aria-label={`Choose book ${book.name}`}
                    onClick={() => void handleBook(book)}
                  >
                    {book.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {loading && <p role="status">Opening the book…</p>}
          {error !== null && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </Modal>
    );
  }

  if (step === "scope") {
    return (
      <Modal
        title={title}
        onClose={close}
        onEnterClickId="next"
        buttons={{
          back: { text: "Back", dangerous: false, onClick: () => setStep("source") },
          next: {
            text: "Next",
            dangerous: false,
            disabled: picked.size === 0,
            onClick: continueFromScope,
          },
          cancel: { text: "Cancel", dangerous: false, onClick: close },
        }}
      >
        <div className="im-body">
          <p>
            Choose what to bring from <strong>{chosen?.label}</strong>
            {scope === "recipes" ? ". The ingredients each recipe needs come with it." : "."}
          </p>
          <div className="im-list-actions">
            <button type="button" onClick={() => setPicked(new Set(items.map((i) => i.id)))}>
              Select all
            </button>
            <button type="button" onClick={() => setPicked(new Set())}>
              Select none
            </button>
            <span role="status">{picked.size} selected</span>
          </div>
          {items.length === 0 ? (
            <p>This book has no {scope === "recipes" ? "recipes" : "ingredients"}.</p>
          ) : (
            <ul className="im-list" aria-label={scope === "recipes" ? "Recipes" : "Ingredients"}>
              {items.map((item) => (
                <li key={item.id} className="im-choice">
                  <label className="im-choice">
                    <input
                      type="checkbox"
                      checked={picked.has(item.id)}
                      aria-label={`Import ${item.label}`}
                      onChange={() => togglePicked(item.id)}
                    />
                    {item.label}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    );
  }

  if (step === "options") {
    const hasFolders = (bundle?.recipe_folders.length ?? 0) > 0;
    return (
      <Modal
        title={title}
        onClose={close}
        onEnterClickId="next"
        buttons={{
          back: {
            text: "Back",
            dangerous: false,
            onClick: () => setStep(chosen?.source === null ? "source" : "scope"),
          },
          next: { text: "Next", dangerous: false, onClick: () => setStep("preview") },
          cancel: { text: "Cancel", dangerous: false, onClick: close },
        }}
      >
        <div className="im-body">
          <div className="im-field">
            <label htmlFor="import-folder">Destination folder</label>
            <select
              id="import-folder"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
            >
              <option value="">Top level</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.path}
                </option>
              ))}
            </select>
          </div>
          <div className="im-field">
            <label htmlFor="import-new-folder">New folder inside it (optional)</label>
            <input
              id="import-new-folder"
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
            />
          </div>
          {hasFolders && (
            <fieldset className="im-fieldset">
              <legend>Folders</legend>
              <label className="im-choice">
                <input
                  type="radio"
                  name="import-folder-mode"
                  checked={folderMode === "retain"}
                  onChange={() => setFolderMode("retain")}
                />
                Keep the file's folder structure
              </label>
              <label className="im-choice">
                <input
                  type="radio"
                  name="import-folder-mode"
                  checked={folderMode === "flatten"}
                  onChange={() => setFolderMode("flatten")}
                />
                Put every recipe straight in the destination
              </label>
            </fieldset>
          )}
          <div className="im-field">
            <label htmlFor="import-on-match">If a recipe is already in the book</label>
            <select
              id="import-on-match"
              value={onMatch}
              onChange={(e) => setOnMatch(matchActionOf(e.target.value))}
            >
              {MATCH_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {ACTION_TEXT[action]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    );
  }

  if (step === "preview") {
    const summary = plan === null ? null : summarizeImportPlan(plan, "preview");
    const recipeRows = plan?.rows.filter((r) => r.entity === "recipe") ?? [];
    const otherRows = plan?.rows.filter((r) => r.entity !== "recipe") ?? [];
    const empty = plan === null || isEmptyImportPlan(plan);
    return (
      <Modal
        title={title}
        onClose={close}
        onEnterClickId="import"
        buttons={{
          back: {
            text: "Back",
            dangerous: false,
            onClick: () =>
              setStep(
                scope === "ingredients"
                  ? chosen?.source === null
                    ? "source"
                    : "scope"
                  : "options",
              ),
          },
          import: { text: "Import", dangerous: false, disabled: empty, onClick: runImport },
          cancel: { text: "Cancel", dangerous: false, onClick: close },
        }}
      >
        <div className="im-body">
          {summary !== null && (
            <>
              <p className="im-summary" role="status">
                {summary.message}
              </p>
              {summary.warnings.map((warning) => (
                <p key={warning} className="field-error">
                  {warning}
                </p>
              ))}
            </>
          )}
          {recipeRows.length > 0 && (
            <ul className="im-list" aria-label="Recipes">
              {recipeRows.map((row) => (
                <li key={row.incoming_id} className="im-row">
                  <span className="im-row-name">{row.name}</span>
                  {row.recipe_match !== undefined ? (
                    <select
                      aria-label={`What to do with ${row.name}`}
                      value={recipeActions[row.incoming_id] ?? onMatch}
                      onChange={(e) =>
                        setRecipeActions((prev) => ({
                          ...prev,
                          [row.incoming_id]: matchActionOf(e.target.value),
                        }))
                      }
                    >
                      {MATCH_ACTIONS.map((action) => (
                        <option key={action} value={action}>
                          {ACTION_TEXT[action]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="im-row-status">{actionText(row)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {otherRows.length > 0 && (
            <details>
              <summary>Ingredients and other items ({otherRows.length})</summary>
              <ul className="im-list" aria-label="Other items">
                {otherRows.map((row, i) => (
                  <li key={`${row.entity}-${row.incoming_id}-${i}`} className="im-row">
                    <span className="im-row-name">
                      {row.name} <small>({row.entity})</small>
                    </span>
                    <span className="im-row-status">{actionText(row)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </Modal>
    );
  }

  // step === "done"
  const result = applied === null ? null : summarizeImportPlan(applied, "done");
  return (
    <Modal
      title={title}
      onClose={close}
      onEnterClickId="close"
      buttons={{ close: { text: "Close", dangerous: false, onClick: close } }}
    >
      <div className="im-body">
        {result !== null && (
          <>
            <p className="im-summary" role="status">
              {result.message}
            </p>
            {result.warnings.map((warning) => (
              <p key={warning} className="field-error">
                {warning}
              </p>
            ))}
          </>
        )}
        <p>"Undo" in the header takes the whole import back.</p>
      </div>
    </Modal>
  );
}

function matchActionOf(value: string): RecipeMatchAction {
  if (value === "keep_both" || value === "skip") return value;
  return "merge_version";
}
