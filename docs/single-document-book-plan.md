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

- New `packages/shared/src/yjs/bookMetaStore.ts` with a `"book_meta"` root map: `id` (`RecipeBookId`), `name`, `created_at`, `schema_version` (start at `1`), `seeded_defaults?`.
- Put the display name in the doc so it travels with the book; the device registry (1e) caches it.
- Reserve — but do not yet implement — an `acl` map. Because any writer to a Yjs doc can edit any of its maps, the **authoritative** ACL must live server-side (or in an owner-only doc); anything in `book_meta` is advisory display data. Record this in `AGENTS.md` when implemented.

### 1d. Seed defaults exactly once

- Move the default-kitchenware CSV import out of `useIngredientStore` into a `seedDefaultKitchenware(doc)` step run at book creation / first open, guarded by `book_meta.seeded_defaults`. This stops it from re-seeding a book whose user deliberately deleted everything.
- Run the seed in a transaction with a **non-tracked origin** (see 1f) so Undo can never remove the defaults.

### 1e. Device book registry (goal 2)

- New `packages/web/src/hooks/useBookRegistry.ts`, stored in localStorage under `chefe_books` (a list of `{ id, name, created_at, last_opened_at }`) plus `chefe_active_book_id`, validated with an `arktype` `Companion` and accessed only through `storage/safeLocalStorage.ts`. `useLocalViewState` is a reasonable base.
- One-time migration of the legacy `ecookdeck_book` entry into the list, then remove the old key (this also retires the legacy prefix).
- API: `createBook(name)`, `renameBook(id, name)` (keeps the id; writes `book_meta.name` in the doc and updates the cache), `openBook(id)`, `deleteBook(id)` (confirm modal; removes the registry entry and `indexedDB.deleteDatabase("book-${id}")`).
- `loadBookDoc(bookId): Promise<{ doc, dispose }>` — opens a book's document **without activating it** (temporary `Y.Doc` + `IndexeddbPersistence`, `await whenSynced`, caller disposes). This is what import-from-device (Phase 3) and the deferred ingredient fallback (goal 7) build on.
- UI: `SelectBookPage` becomes a list of books on the device plus "New book"; the nav header's book name opens a switcher. `AuthenticatedShell` is already `key={book.id}`, so switching remounts cleanly and resets undo.
- Tests: registry validation (malformed JSON, wrong shape → default + `console.warn`), rename keeps id, legacy-key migration, `loadBookDoc` leaves the active doc untouched.

### 1f. Atomic undo (goal 1)

- New `useBookUndoManager(doc)` hook creating one `Y.UndoManager` whose scope is every root map **except** the session maps, provided through a `BookUndoContext` at `AuthenticatedShell` level so the stack survives page navigation.
- Default tracked origin (`null`) already means: local edits are undoable; IndexedDB loads and future server sync (origin = provider) are not. Give seeding, migration and any future remote apply their own origins so they are never undoable.
- Expose `{ undo, redo, canUndo, canRedo }`, kept reactive via `stack-item-added` / `stack-item-popped`; wire the existing nav "↩ Undo" button (disabled when `!canUndo`). Redo is available from the manager; add a button only if wanted.
- **Atomicity rule:** one user action = one `doc.transact(...)`. Audit multi-step store operations (`findOrCreateLabel` + `addIngredient`, saving a recipe version + creating a folder, session "create new version") and wrap them. Add a helper `runAsUndoStep(undoManager, doc, fn)` that calls `stopCapturing()`, runs `fn` in one transaction, then `stopCapturing()` again so the default 500 ms capture window cannot merge it with a neighbouring edit. Imports (Phase 3) use it.
- Decided: **session maps are excluded from undo.** Checking off a step while cooking is run-state, not an edit to the book; including it would let Undo uncheck steps or reopen a completed session. "Create new version" from a session writes to `recipes`, which _is_ tracked.
- Note the existing granularity: stores write whole JSON objects per id, so Undo restores a whole entry (not one field). That is acceptable and unchanged.
- Tests: undo spans an ingredient edit then a recipe edit in order; seeding/migration are not undoable; session ticks are not undoable; a multi-step action undoes in one press; stack resets on book switch.

### 1g. Stored name keys and name uniqueness

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
