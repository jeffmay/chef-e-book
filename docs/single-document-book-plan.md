# Plan: One Yjs Document per Recipe Book, with JSON Export / Import

Status: proposed · Branch: `top-level-document`

## Goals

1. A single atomic undo across a recipe book **and** its ingredients list.
2. A list of the books available on this device; each book is its own Yjs document that can later be synchronized with the server.
3. Export selected (or all) ingredients as JSON.
4. Export selected recipes plus only the ingredients they require as JSON.
5. Import and merge ingredients and recipes from a JSON export into a designated root folder, either retaining the exported sub-folder structure or flattening into that root.
6. The same import and merge from another book on the device.
7. (Deferred) When a recipe references an ingredient missing from this book, offer to import it from another book on the device.

## Decision

The **recipe book is the one top-level `Y.Doc`**. It holds the ingredients tree (ingredients, containers, labels), the recipes tree (recipes, folders), sessions, settings, and — later — authorization data. Multiple books exist only as separate documents on one device; moving content between books always goes through the export/import pipeline, never through live cross-document links.

Why this fits the stated expectations: multiple books are rare, live collaboration is rare, import-and-customize is common, history does not matter on import, and only one book is open at a time. The one-document model gives the atomic undo for free and makes the server's existing "one blob per `book_id`" storage correct as-is.

### Findings from the current code that shape the plan

- `root.tsx` already derives **both** docs from the one `book.id` (`kitchenware-${id}` and `recipes-${id}`), so the two docs are already per-book — merging them is a storage change, not a conceptual one.
- Every Yjs root map name is already distinct (`ingredients`, `containers`, `labels`, `recipes`, `recipe_folders`, `sessions`, `session_item_states`, `book_settings`), so the two docs can be merged by applying one update onto the other with no key collisions.
- The "↩ Undo" button in `root.tsx` is inert; there is no `Y.UndoManager` anywhere yet.
- `useActiveBookMeta().setActiveBookName` generates a **new random book id on every call**, and `root.tsx` passes it as `onRename`. Renaming a book therefore silently creates a new empty book. This must be fixed in Phase 1.
- The book registry is a single localStorage key, `ecookdeck_book`, holding one `{ id, name }`. The `chefe_` prefix is the standard for new keys.
- The default-kitchenware seed lives in `useIngredientStore`'s effect and re-runs whenever `ingredients` and `labels` are both empty — including after a user deletes everything.
- Label ids are random 7-char ids and labels are matched **by name** (`findOrCreateLabel`, which scans the whole labels map), so label ids differ between books even for the same label. Nothing stores a normalized name today, so every name lookup is a scan and nothing prevents two ingredients from sharing a name. Default ingredients/containers have deterministic `-`-padded ids shared across books; user-created ones are random.
- Equipment ids are referenced by instructions but there is no equipment Yjs store yet. Confirm what `initFromKitchenwareTemplates` does with `EquipmentTemplate` rows before Phase 2 and treat equipment like containers if it is persisted.

---

## Phase 1 — Yjs document structure

Ship as separate, individually-mergeable steps. Each ends with typecheck/test/format/lint green.

### 1a. Collapse to one document per book (mechanical, low risk)

- Replace `useKitchenwareDoc` / `useRecipeBookDoc` in `useYjsDoc.ts` with a single `useBookDoc(bookId)` backed by one `IndexeddbPersistence("book-${bookId}")`.
- Replace the two contexts in `contexts/docContext.ts` with a single `BookDocContext` and `useBookDoc()`. To avoid touching ~9 test files in the same commit, first keep `useKitchenwareDoc()` / `useRecipeBookDoc()` as thin aliases returning the same context value, migrate callers and tests, then delete the aliases in a final cleanup commit.
- Update `root.tsx` to provide one context.

### 1b. Legacy data migration

- **Status: implemented** in `packages/web/src/storage/legacyBookMigration.ts` (`mergeLegacyBookData`), called from `useBookDoc` after IndexedDB loads and **before** `whenSynced` resolves.
- On every open of a book, for each of `kitchenware-${id}` / `recipes-${id}` that exists (probed with `indexedDbExists`, which aborts the creating upgrade so a missing database is never created): load it and `Y.applyUpdate(bookDoc, Y.encodeStateAsUpdate(legacyDoc), MIGRATION_ORIGIN)`.
- **No "migrated" flag.** Merging is idempotent — a Yjs update the doc already holds is a no-op, and an entry deleted after the first run is not resurrected — so a flag would only be an optimization. An in-doc flag (`book_meta.migrated_legacy`, as first drafted) would also be wrong: the legacy databases are per-device, and once docs sync, a flag set on device A would stop device B from migrating its own legacy data. A device-local flag was rejected because it could be written before the merged data reaches the book database. The cost is one cheap probe per open until the legacy databases are removed.
- Because `whenSynced` waits for the merge, default seeding cannot observe an empty doc mid-migration. A failed merge is logged and does not block the app; a cancelled run (StrictMode, unmount) leaves resolving to the next run.
- Do not delete the legacy IndexedDB databases in this release (they are the rollback path); add a follow-up to remove them later.
- Tests (`legacyBookMigration.test.ts`, using `fake-indexeddb`; hook ordering in `useYjsDoc.test.ts`): disjoint legacy docs merge into one; either database alone merges; existing book entries are kept; the legacy databases are left in place; idempotent and no resurrection of deleted entries; `MIGRATION_ORIGIN` on every write; persisted to the book database across a reload; cancellation; a read failure propagates; `whenSynced` waits for the merge, survives a failed merge, and never resolves for a cancelled run.

### 1c. `book_meta` map and schema version

- **Status: implemented.** New `packages/shared/src/yjs/bookMetaStore.ts` with a `"book_meta"` root map: `id` (`RecipeBookId`), `name`, `created_at`, `updated_at` (optional; stamped by `setBookName` in the same transaction as the rename, and filled in on open for books that predate it), `schema_version` (`BOOK_SCHEMA_VERSION`, starting at `1`). `seeded_defaults` is added by 1d, which is its only user (the schema is additive).
- `ensureBookMeta(doc, { id, name })` runs on every open from `useEnsureBookMeta` (called in `AuthenticatedShell`) **after** `whenSynced`, so after the legacy merge. It fills in only what is missing and never overwrites, so it is safe on every open, repairs a partial map, and cannot clobber a rename made on another device. It writes with `SETUP_ORIGIN` (never undoable). A doc whose stored `id` is another book's is left untouched with a warning; a newer `schema_version` than this build understands is warned about, not downgraded. Pre-`book_meta` books get `created_at` = first open by this build.
- `setBookName(doc, name)` renames the book (a normal, undoable edit). Nothing reads `book_meta` in the UI yet: the header still shows the name from the localStorage registry, and the reactive read hook, the rename flow, and registry caching land with 1e.
- Put the display name in the doc so it travels with the book; the device registry (1e) caches it.
- Reserve — but do not yet implement — an `acl` map. Because any writer to a Yjs doc can edit any of its maps, the **authoritative** ACL must live server-side (or in an owner-only doc); anything in `book_meta` is advisory display data. Record this in `AGENTS.md` when implemented.

### 1d. Seed defaults exactly once

- **Status: implemented.** The CSV import moved out of `useIngredientStore` into `seedDefaultKitchenware(doc, templates)` (`packages/shared/src/yjs/defaultKitchenware.ts`), driven by `useSeedDefaultKitchenware` in `AuthenticatedShell`, after `useEnsureBookMeta` (so `book_meta` exists before the flag is recorded in it).
- It checks, seeds, and sets `book_meta.seeded_defaults` in **one transaction with `SETUP_ORIGIN`**: concurrent callers cannot both seed, and Undo can never remove the defaults. Outcomes: `seeded`, `already_seeded`, `book_has_data` (an existing book or one filled by a sync/import is marked without being touched).
- This stops re-seeding a book whose user deliberately deleted everything. Books that existed before 1d and are currently empty get the defaults once.
- The CSV is fetched only when `needsDefaultKitchenware(doc)`; a failed, non-OK, or empty fetch leaves the book unmarked so the next open retries.
- Tests moved from stubbing `fetch` to a `seedKitchenwareFromCsv(doc, csv)` helper in `testUtils.ts`; seeding itself is covered in `defaultKitchenware.test.ts` (shared) and `useSeedDefaultKitchenware.test.ts` (web).

### 1e. Device book registry (goal 2)

- **Status: implemented.** Model and storage in `packages/web/src/storage/bookRegistry.ts`, state in `useBookRegistry`, database helpers in `storage/bookDatabases.ts`, name sync in `useSyncBookName`, UI in `SelectBookPage` and the `AuthenticatedShell` header in `root.tsx`.
- **One key, not two.** The registry is stored under a single `chefe_books` key as `{ books: [{ id, name, created_at, last_opened_at }], active_book_id? }` (validated by an `arktype` `Companion`, read and written only through `storage/safeLocalStorage.ts`). The plan first listed a separate `chefe_active_book_id`; one key keeps the list and the active id in step in a single write, so the active id can never name a book that is not listed (`normalizeBookRegistry` also repairs that and duplicate ids on read). The hook reads it lazily on the first render and writes every change straight through.
- **Legacy migration:** the old `ecookdeck_book` `{ id, name }` is adopted as the open book on first read, the new key is stored, then the old key is removed (retiring the legacy prefix). A corrupt new key falls back to the legacy key; both unusable gives an empty registry.
- **API (`BookRegistryStore`):** `createBook(name)` (trims; blank creates nothing), `openBook(id)` (stamps `last_opened_at`), `closeBook()` (back to the picker), `renameBook(id, name)` (cached name only, id unchanged), `deleteBook(id)` (removes the entry, then deletes the book's databases: `book-<id>` and both legacy ones).
- **The document's name leads; the registry caches it.** The picker and header show the cached name before a book's document has loaded. `useSyncBookName` copies `book_meta.name` into the cache once the document syncs and whenever it changes (a rename on another device, or an undo). The open book renames through `setBookName(doc, …)` (`RootContext.onRename`, which no longer creates a new book as the old `setActiveBookName` did — **that bug is fixed**). A book that is not open is renamed with `writeBookName(id, name)`, which opens its document, writes `book_meta.name`, and closes it, then updates the cache.
- **`loadBookDoc(bookId): Promise<{ doc, dispose }>`** opens a book's document **without activating it** (temporary `Y.Doc` + `IndexeddbPersistence`, awaits `whenSynced`, merges any legacy data like a normal open; the caller disposes, which waits for pending writes). It must not be used for the book open in this tab: two persistences on one database do not see each other's writes until a reload. This is what import-from-device (Phase 3) and the deferred ingredient fallback (goal 7) build on.
- **UI:** `SelectBookPage` is the picker: the books on this device (most recently opened first), each with "✎" rename (an `AcceptOrCancelEditor`), "✕" delete (a `Modal` whose Enter key is bound to Cancel, so the safe choice is the default), and tap-to-open; below it the "Book name" / "Create book" form. The nav menu gets a "Switch Books" item that calls `closeBook()`, with the device's books in a flyout to its right on hover (listed beneath it where there is no hover; choosing one calls `openBook`); deleting is only offered from the picker, where no book is open, so the delete is not held up by an open connection. `AuthenticatedShell` is `key={book.id}`, so switching remounts cleanly.
- **Not done:** the registry does not react to `storage` events from other tabs, so two tabs can disagree about which book is open until reload.
- Tests: registry read/validate (malformed JSON and wrong shape warn and fall back, legacy adoption, new key preferred), every pure operation, the hook (create, open, close, rename, delete including a failed delete), `loadBookDoc` / `writeBookName` / `deleteBookDatabases` against `fake-indexeddb` (other books untouched, writes persisted on dispose), `useSyncBookName`, `SelectBookPage` (list, open, rename, delete confirmation and keys), and `Root` end to end (create, legacy adoption, switch, rename keeps the id, delete).

### 1f. Atomic undo (goal 1)

- **Status: implemented.** `createBookUndoManager(doc)`, `getBookUndoScope(doc)` and `runAsUndoStep` live in `packages/shared/src/yjs/undo.ts`; `useBookUndoManager(doc)` (`hooks/useBookUndoManager.ts`) and `BookUndoContext` / `useBookUndo()` (`contexts/undoContext.ts`) wire it into `AuthenticatedShell`, which provides the context and drives the header's "↩ Undo" button (reads "✕ Undo", disabled, on a grey background with the text kept black for e-ink, when `!canUndo`). The manager lives in the shell, so the history survives navigation between pages; the shell is `key={book.id}` and the hook destroys its manager on unmount, so every book open starts with an empty history.
- **One `Y.UndoManager`** over the ingredients list and the recipes tree together: `ingredients`, `containers`, `labels`, `recipes`, `recipe_folders`, `book_settings`, `book_meta`. It tracks only the default `null` origin, so local edits are undoable while `SETUP_ORIGIN` (book setup, default kitchenware), `MIGRATION_ORIGIN`, IndexedDB loads and anything a future sync provider applies are not — and undoing never reverts another device's edit.
- **Decided: the session maps are excluded** (`sessions`, `session_item_states`). Ticking a step while cooking is run-state, not an edit to the book; saving a version _from_ a session writes to `recipes`, which is in scope, so that is undoable. A new root map is outside the history until it is added to `getBookUndoScope`.
- The hook exposes `{ undo, redo, canUndo, canRedo, stopCapturing, runAsStep }`, kept reactive through `stack-item-added` / `stack-item-popped` / `stack-cleared`. There is no Redo button (the top nav spec only has Undo); `redo` is available for one later. The manager is created in an effect, not during render, because it attaches document listeners and a StrictMode double-render would leak one.
- **Step boundaries.** Yjs's default `captureTimeout` (500 ms) is kept: edits made back to back from one gesture undo together. `runAsUndoStep(undoManager, doc, fn)` runs `fn` as exactly one transaction that never merges with the edit before or after it; it is implemented and tested here but nothing uses it yet — Phase 3's import will, so one Undo reverts a whole import.
- **Atomicity audit.** The shared store functions were already single transactions (bulk ones use `doc.transact`). The multi-step flows that were not, and are now one transaction each: `useIngredientStore.createIngredient` (new labels + the ingredient), `useLabelStore.deleteLabels` (the label and its removal from every ingredient; the observer that does the same for deletions arriving from elsewhere stays, and finds nothing left to do), and `RecipeSessionPage`'s "Create a new recipe" (the recipe + its first version). Creating a folder from the recipe editor's folder selector is its own action, so its own step. Because transactions started from an observer are separate transactions, any future cascade must be done explicitly inside the originating transaction.
- Note the existing granularity: stores write whole JSON objects per id, so Undo restores a whole entry (not one field). That is acceptable and unchanged.
- Tests: `undo.test.ts` (shared: scope, ordering across ingredients and recipes, every in-scope map, sessions untouched, setup/migration/remote not undoable, step boundaries, `runAsUndoStep`), `useBookUndoManager.test.tsx` (reactivity, undo/redo, per-book reset, no leaked manager under StrictMode), single-transaction and one-step-undo tests for `createIngredient`, `deleteLabels` and the session page's new recipe, and `Root.test.tsx` (nothing to undo in a freshly opened book, edit then undo, history kept across navigation, reset when the book is reopened).

### 1g. Stored name keys and name uniqueness

**Status: implemented.** What was built, where it differs from the design below, and what is left:

- Shared: `names/nameKey.ts` (`ingredientNameKey`, `labelNameKey`, `NAME_KEY_VERSION = 1`, built on the `pluralize` library with a `NOT_PLURAL` exceptions set and a `SINGULAR_OVERRIDES` map), `names/nameIndex.ts` (`buildNameIndex`, `findNameClash`, `duplicateIds`), `names/nameClash.ts` (`NameClash`, `describeNameClash`, `NameClashError`), `names/storedName.ts` (`readNameKey`, `readStoredNameKey`), `yjs/nameKeys.ts` (`rekeyBookNames`), and per-store `getXNameIndex` / `findXNameClash` / `rekeyX` for ingredients, containers, and labels. `book_meta` gained `name_key_version`.
- Every `toStored` writes `name_key` derived from `name`. A rename keeps the id and rewrites name and key in one entry. `findLabelByName` now matches by label key (case-insensitive, normalized) instead of exact text, so `findOrCreateLabel("DAIRY")` reuses "dairy".
- `useRekeyBookNames` (in `AuthenticatedShell`, after `useSeedDefaultKitchenware`) runs `rekeyBookNames` once the book has synced: it rewrites every stale or missing key and records the version in one `SETUP_ORIGIN` transaction (atomic, never undoable); a book keyed by a newer build is left alone with a warning.
- **Enforcement is in the hooks, not the raw store functions.** The shared `addIngredient` / `renameIngredient` / … stay permissive, because duplicates must be representable (older data, concurrent edits, sync). `useIngredientStore`, `useContainerStore`, and `useLabelStore` expose `nameClash(name, exclude?)` and throw `NameClashError` from create / rename / merge when another entry already holds the name, so no UI path can create a duplicate. Merge excludes the labels being merged, so labels can be merged into the name of one of them.
- UI: the Add-ingredient form shows the clash (`.field-error`, `.field-input--error`, `aria-invalid`) and disables Add; the ingredients table's inline name edit and the label table's rename and merge show it and do not commit; `IngredientsTable` flags existing duplicates with a "duplicate name" marker. The default-kitchenware CSV is asserted to have no duplicate keys.
- **Not done:** containers have the store and hook support but no UI creates or renames them yet; equipment has a key function but no store; the recipe editor has no inline ingredient creation to wire. The cross-book lookup and import matching that read these keys are Phase 3 and the deferred fallback. Accents are not folded ("jalapeño" ≠ "jalapeno"), and only the last whitespace-separated word is singularized, so a trailing note such as "Tomatoes (canned)" does not match "Tomato (canned)".

Names are matched in three places (create/rename clash checks, import matching, and the deferred cross-book ingredient fallback), so the normalized form is **stored** rather than recomputed on every lookup.

- New pure module `packages/shared/src/names/nameKey.ts`:
  - `ingredientNameKey(name)` — trim, Unicode-normalize (NFKC), lowercase (locale-independent), collapse internal whitespace, then **singularize the last word** (inflection library plus an exceptions list: "molasses", "hummus", "couscous", "asparagus", "swiss", …). Used for ingredients, containers, and equipment.
  - `labelNameKey(name)` — the same steps **without** singularizing. Labels are unique only by trimmed, normalized, case-insensitive name; "Spices" and "Spice" are different labels.
  - `NAME_KEY_VERSION = 1`, bumped whenever either function (or the exceptions list) changes.
- **Storage:** every ingredient, container, equipment, and label entry gains a `name_key: string` field. `toStored` always derives it from `name`; callers never supply it, so the two cannot drift, and because it is part of the same Yjs entry, a rename updates name and key atomically (and Undo restores both). The display `name` is never altered.
- **Identity is the id, not the name.** A rename keeps the entity's id (so every recipe reference, `parent_id`, and label set stays valid) and only rewrites `name_key`. The clash check on create and rename is `findByNameKey(key)` **excluding the entity's own id**, so renaming "Tomato" to "Tomatoes" (same key) is allowed, while renaming "Basil" to "Tomatoes" is refused when a different ingredient already holds that key. A refusal uses the shared `.field-required` / `.field-error` styling and names the existing item.
- **Lookup index:** an in-memory `Map<name_key, id[]>` per kind, built by a pure `buildNameIndex(entries)` and rebuilt by the store hooks inside their existing Yjs `observe` handlers — O(1) lookups with no extra document state. It is deliberately **not** a second Yjs map: Yjs cannot enforce uniqueness across concurrent writers, and a `name_key → id` map would be last-writer-wins and could point at the wrong entity, whereas a key stored on the entry itself can never disagree with it.
- **Uniqueness scope (decided):** unique per kind across the whole book — not per parent — so "Cheddar" cannot exist twice under different parents. This also removes the need for parent-path matching in import (3c). If per-parent uniqueness is preferred instead, the index key becomes `(parent_id, name_key)` and 3c reinstates parent-path matching.
- **Duplicates are tolerated, not auto-merged.** Uniqueness is enforced on local writes. Duplicates that already exist, or that arrive later via concurrent edits or sync, are kept (the index holds a list), marked in the bulk ingredient editor with the `.field-error` indicator, and resolved by the user renaming one. Import and lookups resolve a multi-entry key deterministically to the lowest id.
- **Backfill and re-keying:** old entries have no `name_key`. On book open, if `book_meta.name_key_version` is missing or lower than `NAME_KEY_VERSION`, a single transaction with a **non-undoable origin** (like seeding) recomputes and writes every key and then records the version. This also covers a future change to the singularizing rules.
- **Defaults:** default kitchenware goes through `toStored`, so it gets keys too. A fixture test asserts the shipped `kitchenware.csv` has **no duplicate keys** (per kind); if it does, fix the CSV rather than loosening the rule.
- **Replaces name scans:** `findOrCreateLabel` and the "Add new ingredient" form use the index; the bulk editor's rename path and the recipe editor's inline ingredient creation call the same clash check.
- Tests: key table for ingredients (case, whitespace, NFKC, regular and irregular plurals, exceptions, multi-word) and for labels (same, but "Spices" ≠ "Spice"); `toStored` always writes the derived key; create/rename clash and self-rename allowed; rename keeps id and references; index lookups and duplicate listing; backfill and version-bump re-key are idempotent and not undoable; CSV fixture has no duplicate keys.

### 1h. Docs

Update `AGENTS.md` (architecture, Yjs data model, `book_meta`, registry, undo scope, new localStorage keys) and `PROJECT_SUMMARY.md`.

---

## Phase 2 — Export

**Status: implemented.** Shared logic is in `packages/shared/src/export/` (`recipeBookExport.ts`: format, `serializeRecipeBookExport`, `parseRecipeBookExport`; `buildExport.ts`: the pure closure, `buildIngredientExport` / `buildRecipeExport`; `exportFromDoc.ts`: `exportIngredients` / `exportRecipes`, `summarizeExport`, `exportFileName`). The web side is `downloadTextFile` (`utils/`), `useBookExport`, and `ExportNotice`. Where it differs from the design below:

- **No options dialog and no Modal.** Export downloads immediately; what it did (and anything it could not find) shows in an `ExportNotice` status under the actions, until dismissed.
- **Recipes are selected by id only.** The recipe tree can only select recipes, not folders, so there is no folder-subtree expansion; `buildRecipeExport` takes recipe ids.
- **Ingredient export is ingredients only** — "Export all" brings every ingredient (with ancestors and labels) but not containers; containers travel with the recipes that use them.
- **Equipment is not exported.** There is no equipment store; instructions refer to equipment by id into a list the app ships (`COMMON_EQUIPMENT`), so those ids simply stay inside the recipes and are never "missing".
- **`parseRecipeBookExport` was built here, not in Phase 3**, because the round-trip tests need it. It never throws: bad JSON, a file that is not an export, a **newer `format_version`** (refused with "Update the app"), and schema failures each come back as a readable message. Phase 3 reuses it.
- **Dangling references are repaired in the copies, and recorded.** An ingredient or container `parent_id`, a label id, or a folder id that names nothing in the book is dropped from the exported entry (so the file never points at something it lacks) and added to `missing_references` once; a selected id that names nothing is recorded with `referenced_by: { kind: "selection" }`. A recipe that fails the export schema (e.g. a malformed `source_url`) is left out with a `console.warn`, and what only it needed is not dragged in.
- The files are deterministic: lists are sorted by name (recipes by title) then id, so the same selection always exports the same text.
- Labels are validated in their array form (the schemas turn arrays into Sets); `serializeRecipeBookExport` writes Sets back as arrays.

All export logic is pure and lives in a new `packages/shared/src/export/` so it is shared by the web app, tests, and (later) the server. The UI only calls it and downloads the result.

### 2a. Export format

`RecipeBookExport` as an `arktype` `Companion`:

```
{
  format: "chefe_book_export",
  format_version: 1,
  exported_at: number,
  source_book: { id, name },
  ingredients: Ingredient[],          // labels as string[] (reuse the setOf array morph)
  containers: Container[],
  labels: KitchenwareLabel[],         // only those referenced by included items
  recipe_folders: RecipeFolder[],     // ancestor chains of exported recipes
  recipes: Recipe[],                  // each carries only its latest version
  missing_references: { kind, id, referenced_by }[]   // dangling ids found while exporting
}
```

- Reuses the existing `Ingredient` / `Container` / `Recipe` / `RecipeFolder` schemas so import validation is the same code that validates stored data.
- `name_key` is **not exported**: it is derived data, and the importing book recomputes it with its own `NAME_KEY_VERSION` so both sides always agree.
- Round-trip test: `Set` ↔ array for labels, `Fraction` values, optional fields.
- Unknown newer `format_version` must be rejected on import with a clear message.

### 2b. Dependency closure

`collectRecipeDependencies(doc/data, recipeIds)` returns the ids to include:

- Ingredients referenced by each version's top-level `ingredients`, section `IngredientItem`s (including those nested in containers), and `Instruction.ingredient_ids` (reuse `collectIngredientItems` / `collectInstructions` from `sections.ts`).
- **Ancestors via `parent_id`** for every included ingredient/container, so the hierarchy ("Shredded Cheddar → Shredded Cheese → Cheese") survives.
- Containers (`container_id`) and equipment (`equipment_id`) referenced by items.
- Labels used by any included ingredient/container.
- Folder ancestor chain for each recipe (so "retain structure" works on import).
- References that resolve to nothing are recorded in `missing_references` and surfaced as a warning, not an error.

### 2c. Selection → export entry points

- `exportIngredients(doc, { ids | "all" })` — selected ingredients plus their ancestors and labels (recipes empty).
- `exportRecipes(doc, { recipeIds })` — recipes plus dependency closure. Selecting a folder expands to its subtree's recipes. **Each recipe exports its latest version only** (decided: history is not part of an export). Dependency closure is therefore computed from the latest version alone, so ingredients used only by older versions are not exported. Lossless backups are out of scope for this export; the Yjs document itself is the backup.
- Both validate every record with the same `arktype` schemas before emitting and log-and-skip invalid entries (consistent with `validateByIdOrLog`).

### 2d. UI

- `BulkIngredientEditorPage`: "Export selected" / "Export all" in the bulk-action bar.
- `BulkRecipeEditorPage`: "Export" in the selection actions (reuse the existing row selection); it downloads immediately, with no options dialog.
- `downloadJson(filename, data)` helper in `packages/web/src/utils/`; filename built from the book slug + date, e.g. `<book-slug>-recipes-2026-11-17.json`.
- Greyscale e-ink rules apply: no animation, no placeholder text, keep the bottom keyboard clearance.

### 2e. Tests

- Unit: closure includes ancestors, containers, labels, folder chains; excludes unreferenced ingredients; handles recipes sharing ingredients (no duplicates); `missing_references` populated; only the latest version is exported and ingredients used solely by older versions are excluded.
- Unit: exported JSON validates against `RecipeBookExport`; invalid stored entries are skipped.
- Component: buttons enabled only with a selection; modal keyboard behaviour; download triggered with the expected payload.
- Use `fixedId` for deterministic ids.

---

## Phase 3 — Import

**Status: implemented** (the Playwright end-to-end is the one piece not written; see the last bullet). Shared logic is in `packages/shared/src/import/` (`importPlan.ts`: `planImport`, `ImportOptions`, `ImportPlan`, `isEmptyImportPlan`, `versionContentSignature`; `applyImport.ts`: `applyImportPlan`, `importBundle`, `planImportIntoDoc`, `restrictBundleToIngredients`, `readImportFile`, `summarizeImportPlan`). The web side is `ImportModal` (`components/import_modal/`), `useBookImport`, `loadBookSource` (`storage/bookSource.ts`), and an "Import" button on each bulk page. Where it differs from the design below:

- **The plan holds concrete writes.** `planImport(targetSource, bundle, options)` is pure and works out every id (the file's id when free, a fresh one when not), every remapped reference, and one `ImportRow` per thing for the preview; `applyImportPlan` is only writes. `importBundle` plans and applies together, against the book _as it is when you press Import_, so a book that changed since the preview cannot be written with a stale plan.
- **Actions** are `create | reuse | new_version | unchanged | skip` (there is no `conflict`: local always wins).
- **Matching.** Labels: by id, then `labelNameKey`; kinds are unioned onto an existing label. Ingredients and containers: by id, then `ingredientNameKey`; two entries in the file that share a name collapse onto one; parents are processed first (a missing parent drops the link with a warning; a loop of parents is cut with a warning). Folders: by id, else by name under the destination parent (so re-importing never duplicates a folder). Recipes: by id anywhere in the book, else by title within the destination folder; recipes from the same file are never matched to each other.
- **Merging a recipe** appends the file's latest version unless the book already has one with the same content (compared ignoring ids, timestamps and the description, against **every** existing version, not only the latest) — so importing the same file twice writes nothing; a new version's description is `Imported from <source> on <yyyy-mm-dd>`. `keep_both` creates a new recipe with every id regenerated and the same title. A per-recipe choice overrides the default.
- **References are rewritten** by the new pure `remapVersionReferences` (`types/sections.ts`) through the ingredient and container remaps; equipment ids are left alone, and an ingredient or container that exists in neither the file nor the book is a warning, not a failure.
- **Overwrite option (added after the original design).** `ImportOptions.overwrite_kitchenware` (a checkbox on the preview step, off by default) lets a matched ingredient or container be replaced by the file's name, labels and parent (and an ingredient's default amount) instead of being left alone — it relaxes "local always wins" for kitchenware only, at the user's request. The id is kept; the name is not applied if another entry of that kind holds its key and a parent is not applied if it would form a loop (warnings); the plan's `ingredients_to_update` and `containers_to_update` hold the whole replaced entries and applying them is part of the one undo step. Labels and recipes are not overwritten (a label only gains kinds); equipment has no store.
- **One undo step.** The whole import is one `doc.transact`; `useBookImport` runs the import through the book's `runAsStep` (`runAsUndoStep`), so one Undo reverts exactly the import. New store writers support it: `putLabel`, `setLabelKinds`, `putRecipeFolder`, `addRecipe`, `appendRecipeVersion`.
- **UI differences from 3e.** The destination is a plain `<select>` of the book's folders (with paths) plus an optional "New folder inside it" name, rather than the `RecipeFolderSelector`, because that selector creates its folder immediately (its own undo step, and left behind if the import is cancelled) while a planned folder is created as part of the one import. "What to bring" from a device book is a flat checklist (recipes with their folder path, or ingredients) with Select all / none, not a tree. A file is imported whole; from the Ingredients page only its ingredients and their labels are (`restrictBundleToIngredients`). Files over 10 MB are refused before parsing; bad JSON, a non-export, and a newer `format_version` each show the parser's message.
- **Not done:** the Playwright end-to-end (export from book A, create book B, import with retain, re-import, Undo) was not written or run; the automatic "missing ingredient → offer from another book" fallback remains deferred until after authentication and sync.

### 3a. One pipeline, two sources

Goals 5 and 6 share the pipeline: **a device book is just another export producer.**

```
source (JSON file | loadBookDoc + exportRecipes/exportIngredients)
   → RecipeBookExport  (validated)
   → planImport(targetDoc, bundle, options) → ImportPlan   (pure, no mutation)
   → preview in UI
   → applyImportPlan(targetDoc, plan)                      (one transaction = one undo step)
```

### 3b. Options

```
{
  target_folder_id: RecipeFolderId | "root",    // the designated root folder
  folder_mode: "retain" | "flatten",
  recipe_match: "id_then_name",                 // see below
  on_match: "merge_version" | "keep_both" | "skip"   // default merge_version, overridable per recipe in the preview
}
```

### 3c. Matching and merge rules (`planImport`)

Build id-remap tables (`incoming id → local id`) first, then rewrite recipes through them.

- **Match keys:** names are compared through the stored `name_key` of the target book (1g) against `ingredientNameKey(incoming.name)` computed at plan time, so singular and plural forms merge ("Cherry Tomatoes" ≙ "cherry tomato"). The importing code never relies on a key from the file.
- **Labels:** match by `labelNameKey` — trimmed, normalized, case-insensitive, **not** singularized; matched labels keep the local id and union their `kinds`; unmatched labels are created (with their `name_key`).
- **Ingredients / containers (/ equipment):** match by id (covers default kitchenware and re-imports of the same book); otherwise by `ingredientNameKey` (unique per kind in the book, so no parent-path comparison is needed); otherwise create, keeping the incoming id when free and generating a new one on id collision. If several incoming items map to the same key (a source book with duplicates), they collapse onto one local item, and recipe references are remapped accordingly. Process parents before children so `parent_id` is always remapped. **Matched items are left untouched — local always wins** (decided); there is no overwrite option, and the preview simply reports them as "reused".
- **Recipes:**
  - Match by id anywhere in the book; otherwise by normalized `title` among recipes in the destination folder (name matching is scoped so it cannot reach into unrelated folders). Recipes from the same bundle are never matched to each other, which matters when flattening.
  - **Merge** a matched recipe by appending the incoming latest version as a new `RecipeVersion` (versions are append-only): skip if that version id already exists, or if the content is structurally identical ignoring ids/timestamps/description; otherwise add it with `description` such as "Imported from <source> on <date>". The matched recipe keeps its local title and folder (no relocation) and is reported as "new version added".
  - **Keep both** creates a new recipe with regenerated ids. Unmatched recipes are created, keeping incoming ids when free.
  - All `ingredient_id` / `container_id` / `equipment_id` / `ingredient_ids` references inside every imported version are rewritten via the remap tables (new pure `remapVersionReferences` walker in `sections.ts`).
- **Folders:** `retain` recreates the incoming ancestor chain under `target_folder_id`, merging into an existing folder of the same name under the same parent instead of duplicating; `flatten` sets every imported recipe's `parent_folder_id` to the target. Drop `manual_order` entries that no longer resolve.
- **Idempotency:** importing the same file twice must produce a plan where everything is `skip`/"identical".

### 3d. `ImportPlan` and apply

- Plan rows: `{ entity, action: "create" | "merge" | "skip" | "conflict", reason }` with summary counts. `planImport` validates everything, so `applyImportPlan` is only writes (Yjs transactions do not roll back on throw, so all failure paths belong in planning).
- `applyImportPlan` runs inside `runAsUndoStep` so one press of Undo reverts the whole import.

### 3e. UI

- "Import" on both bulk pages opens an import `Modal` flow:
  1. Source: choose a JSON file (`<input type="file">`) or pick another book from the device registry.
  2. Scope (device source): choose what to bring — a checkbox tree of folders/recipes and/or ingredients (reuse the `TreeSelect` checkbox pattern).
  3. Options: destination folder via the existing `RecipeFolderSelector`, retain/flatten radio, default match behaviour.
  4. Preview: counts plus per-recipe resolution (merge / keep both / skip).
  5. Apply, then a summary ("3 recipes added, 2 got new versions, 14 ingredients added, 6 reused") and the nav Undo button remains the way back.
- Ingredients-only import skips the recipe options.
- Reject files that are not valid JSON, have the wrong `format`, or a newer `format_version`; cap file size (e.g. 10 MB) before parsing.

### 3f. Tests

- Unit (`planImport`): label merge by name; ingredient match by id, by name+parent, and create with id collision; parent remap ordering; recipe match by id and by name (scoped to destination); version merge vs identical-skip; keep-both regenerates all ids; retain vs flatten; same-bundle duplicate titles when flattening; second import is all-skip; reference rewrite covers containers, instructions and top-level ingredients.
- Unit (`applyImportPlan`): a single undo step; undo restores the exact pre-import state.
- Component: each modal step, validation errors, Escape/Enter via `Modal`, folder selector, per-recipe resolution.
- Playwright E2E: export recipes from book A, create book B, import with retain, assert folders/recipes/ingredients; re-import and assert no duplicates; Undo removes the import.

---

## Deferred (not in these phases)

- **Missing-ingredient fallback (goal 7).** After auth, authorization and server sync land, a recipe's ingredient lookup that misses in the active book calls a `findIngredientInOtherBooks(name)` built on `loadBookDoc` (1e) and offers a one-ingredient `planImport` (3c) with its ancestors. Phases 1 and 3 are shaped so that this is a thin UI addition, not new infrastructure.
- **Authentication, authorization and the sync client.** Today the server stores one blob per `book_id`, which is already correct for the one-document model; the client does not sync yet. The ACL is enforced server-side (see 1c).
- **Removing legacy IndexedDB databases** (`kitchenware-*`, `recipes-*`) after migration has shipped for a release.

## Open questions

Decisions made on 2026-11-17:

1. Sessions are **excluded** from the undo scope (see 1f).
2. Singular and plural names **merge** on import (see 1g and the match keys in 3c).
3. **Local wins** on import; matched local items are never overwritten.
4. Recipe export includes the **latest version only**.

5. Ingredient, container, and equipment names are stored as a derived `name_key` (trimmed, NFKC-normalized, lowercased, last word singularized) used for uniqueness and matching; the entity id stays stable across renames (see 1g).
6. **Labels** are unique by trimmed, normalized, case-insensitive name and are **not** singularized.

7. Name uniqueness is **per kind across the whole book**, not per parent (1g).

No open questions remain.

## Suggested commit/PR sequence

1. 1a + 1b (one doc, migration) → 2. 1c + 1d (meta, seeding) → 3. 1e (registry, rename fix, `loadBookDoc`) → 4. 1f (undo) → 5. 1g (name keys, uniqueness, backfill) → 6. Phase 2 (shared export + UI) → 7. Phase 3a–d (plan/apply, no UI) → 8. Phase 3e (UI + E2E).
