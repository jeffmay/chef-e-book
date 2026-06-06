# Recipe Book — Project Changelog Summary

- [x] Monorepo scaffold (npm workspaces: shared, web, server)
- [x] Yjs data models in `shared` (Kitchenware, Recipe, Session, RecipeGroup, Measurement types with kind discriminators)
- [x] Measurement fraction arithmetic (simplify, add, subtract, multiply, divide) with exact rational representation
- [x] Unit conversion tables (US customary volume/weight and metric, exact within each system)
- [x] Default kitchenware CSV static asset (`packages/web/public/kitchenware.csv`) with 11 ingredients, 5 containers, 3 equipment; IDs left-padded to 12 chars with `"-"`; fetched and loaded by `useIngredientStore` on first page load if IndexedDB is empty
- [x] Vite + React 19 web app scaffold with e-ink CSS design system
- [x] Node.js + Express 5 sync server with Yjs document store endpoint
- [x] User selection (first-load page, localStorage persistence, per-user Yjs doc via y-indexeddb)
- [x] Top nav bar: hamburger NavMenu, Undo button, UserMenu with profile settings link
- [x] ProfileSettingsPage (rename user, persists to localStorage)
- [x] Yjs ingredient CRUD store (`shared`) — init from defaults, add/remove labels, set type/parent, rename, set labels
- [x] `useIngredientStore` hook + DocContext (React)
- [x] Ingredients Page — PrimeReact TreeTable tree view (expandable parent→child), in-table per-column filter row (text name filter with auto-expand; multi-select checkbox dropdown for type/labels), sortable columns, inline editable cells (click to edit, Enter/Escape hotkeys, ✔︎/✗ confirm/cancel), PrimeReact checkbox selection with bulk action bar (add/remove labels, change type, change parent), `+ New ingredient` form
- [x] `ItemLabel` type with branded `ItemLabelId` (7-char nanoid); `ItemKind`-scoped labels stored in `"labels"` Yjs map
- [x] Branded IDs for all item types via `ts-brand` + TypeScript declaration merging (`IngredientId`, `ContainerId`, `EquipmentId`, `ItemLabelId`)
- [x] `label_store.ts` — Yjs CRUD (add, find, rename, delete, find-or-create); `useLabelStore` React hook with cascade-delete observer and transactional merge
- [x] `LabelTable` expandable panel — multi-select checkboxes, bulk actions (Filter All, Filter Any, Delete, Merge with name prompt), inline rename; shown above `IngredientsTable` on the Bulk Ingredient Editor page
- [x] External label filter: selecting labels in `LabelTable` and clicking Filter All/Any updates a filter passed to `IngredientsTable` that pre-filters ingredients before tree-building
- [x] ArkType v2 schemas replace manual validation in `ingredient_store.ts` and `label_store.ts`; `MeasurementType` exported as both ArkType schema value and TypeScript type alias from `measurement.ts`
- [x] PapaParse replaces hand-written CSV parser in `parse_kitchenware_csv.ts`; per-kind ArkType schemas (`IngredientRow`, `ContainerRow`, `EquipmentRow`) with pipe morphs for "+" delimited label fields
- [x] `LabelEditor` component (`react-select` `CreatableSelect isMulti`) — add/remove existing labels from a dropdown or type to create a new one; replaces the plain text-input in the `IngredientsTable` Labels cell editor; cancel via ✗ button or Escape (when dropdown is closed)
- [x] `LabelEditor` bug fixes — `menuPlacement="auto"` prevents bottom cutoff; custom `LabelEditorMenu` component intercepts non-left-click mousedown to prevent right-click closing the dropdown; hover color updated to `#ebebeb`, active to `#c4c4c4`; bulk add/remove label actions in `IngredientsTable` now use `LabelEditor` instead of plain text inputs
- [x] `FractionEditor` component — inline fraction display (`integer<sup>num</sup>⁄<sub>denom</sub>` with aria-label); ± opens editor (replaced by <); < resets to pre-edit value (keeps editor open); ÷/×/−/+ radio buttons switch operation rows; op buttons apply math (simplified after each); `extraControls` slot between op buttons and OK; 20 component tests
- [x] `MeasurementEditor` component — same editing UX as FractionEditor sharing `FractionDisplay`, `OP_ROWS`, `OP_MODES`; adds type selector (volume/weight/count) and unit selector with US/metric optgroups; unit change converts fraction within same system (cross-system keeps value unchanged); OK converts to largest whole-number unit before committing; 20 component tests
- [x] `RecipeFolder` type — recursive ArkType scope; replaces flat `RecipeGroup`; `recipe_folder_store.ts` stores flat, builds tree via `buildFolderTree()`; backward-compat aliases exported
- [x] `Recipe` type overhaul — `RecipeId`, `RecipeVersionId`, `RecipeIngredientId` branded IDs; `RecipeIngredient` (id + ingredient_id + optional amount); `RecipeVersion` with `ingredients[]`, `sections[]`, `created_by`; `Recipe` with `title`, `subtitle?`, `source_url?`, `parent_folder_id?`; explicit TypeScript interfaces ensure branded-ID types survive cross-package inference
- [x] `recipe_store.ts` Yjs store — CRUD for recipes with structural validators; `createRecipe`, `saveRecipe` (in-place or new version), `copyRecipe`, `deleteRecipe`; all optional fields use conditional spread for `exactOptionalPropertyTypes` compatibility
- [x] `DurationEditor` component — text input with humanized display (`humanize-duration`), min/sec unit toggle, ±delta buttons (−5/−1/+1/+5 min or −15/−5/+5/+15 sec), revert `<` and commit `OK`; parse input via `parse-duration`; 24 component tests
- [x] `RecipeEditorPage` — full recipe CRUD UI; editor with title/subtitle/source URL/folder/version-description fields; `SectionEditor` (recursive, depth 1–5) with `IngredientSelector`-gated add for ingredients (both ingredient and measurement required), add/remove/edit for instruction/text-block/container/sub-section items; computed read-only ingredient totals derived from sections; version history table; `CopyRecipeDialog`; `DurationEditor` per instruction; `MeasurementEditor` per ingredient; description and amount validation with save guard; 33+ component tests. **Note: per-item notes (attach notes to sections/ingredients/instructions) are temporarily removed and will be re-implemented in a future branch.**
- [x] `useRecipeStore` and `useRecipeFolderStore` React hooks — Yjs-reactive stores for recipes and folders
- [x] ESLint config updated — `varsIgnorePattern: "^_"`, `ignoreRestSiblings: true` for destructure-discard patterns; removed `rules-of-hooks` override for hooks/contexts (now that hooks are camelCase)
- [x] All snake_case function names renamed to camelCase — `randomId`, `loadId`, `addFractions`, `getIngredients`, `useIngredientStore`, `buildFolderTree`, etc.; callback props renamed to camelCase (`onChange`, `onSave`, `onCancel`); file names remain snake_case
- [x] Naming convention rule formalized: camelCase for all component props, local variables, and constants; snake_case for Yjs document fields, Yjs map keys, file names, CSS classes, and string discriminator values (e.g. `"measurement_type"`, `"volume"`)
- [x] `IngredientsTable` migrated from `@tanstack/react-table` to PrimeReact `TreeTable` — removed grouping (no built-in equivalent), standalone `MultiSelectFilter` (no longer coupled to TanStack's `Column` type), filter bar above table instead of column-header filters, PrimeReact lara-light-indigo theme with CSS variable overrides to match the e-ink design system
- [x] `IngredientSelector` component — wraps PrimeReact `TreeSelect` for hierarchical ingredient selection; used in `IngredientsTable` inline parent cell editor and bulk parent action; mock-friendly via `vi.mock("primereact/treeselect")` in tests
- [x] `IngredientsTable` parent column uses `IngredientSelector` instead of plain `<select>` — inline cell editor and bulk action both use tree-select; bulk action bar adds a "Clear parent" button (sets parent to `undefined` without needing to select anything)
- [x] `LabelTable` filter buttons replaced with PrimeReact `RadioButton` group — "Filter: [All] [Any]" styled as button-group with black background / white text on selection; radio circle hidden with CSS clip trick for pure-CSS button appearance; selected mode persists in state
- [x] `Ingredient.default_measurement_type` → `default_measurement_value: Measurement` — backwards migration in `validateStored` auto-converts old Yjs entries; `DEFAULT_MEASUREMENT_BY_TYPE` constant maps type names to default Measurement values; `setMeasurementTypeForIngredients` → `setMeasurementValueForIngredients`
- [x] `Container.parent_id?` added — supports container hierarchy; `container_store.ts` Yjs CRUD store (`getContainers`, `addContainer`, `renameContainer`, `setLabelsForContainer`, `setParentForContainer`); `useContainerStore` React hook
- [x] `KitchenwareParentSelector` component — PrimeReact `TreeSelect` over container hierarchy; builds tree inline from `parent_id` links; CSS prefix `kps-`
- [x] `KitchenwareEditor` component — read-only name + locked kind="container"; `LabelEditor` for label management; `KitchenwareParentSelector` for parent; separate `onChangeLabels` / `onChangeParent` callbacks; CSS prefix `ke-`
- [x] `KitchenwareSelector` component — `react-select` `CreatableSelect` (single); opening/typing creates container immediately and shows modal with `KitchenwareEditor`; Create/Cancel actions; CSS prefix `ks-`
- [x] `RecipeFolderSelector` component — PrimeReact `TreeSelect` over folder tree; inline "+ Folder" button adds subfolder under selected folder (or root); Enter/Escape hotkeys; shows selected path as "/" separated breadcrumb; CSS prefix `rfs-`
- [x] `MeasurementEditor` refactor — new `onCancel` and `initially_open` props; `↩` button moved from header to bottom row (left of ✔︎) and now calls `revertAndClose()` which reverts value and calls `onCancel`
- [x] `IngredientsTable` "Type" column → "Default" — uses `MeasurementEditor` with `initially_open` for inline cell editing; `formatMeasurement` helper; bulk bar uses `MeasurementEditor` instead of type `<select>`; props renamed `onSetMeasurementValue` / `onBulkSetMeasurementValue`
- [x] `RecipeEditorPage` "+ amount" button opens `MeasurementEditor` in editing mode (via `initially_open`) with cancel support; container selector uses `KitchenwareSelector` (WIP — `COMMON_CONTAINERS` fallback replaced); folder selector wired to `RecipeFolderSelector`
- [x] `BulkIngredientEditorPage` add-form updated — `MeasurementEditor` replaces measurement type `<select>`; props updated for renamed ingredient store API
- [x] `IngredientsTable` standalone filter bar replaced by TreeTable's native per-column filter row — name/type/labels filters render as column `filterElement`s in `<th>` cells aligned with their columns; controlled `filters` prop with `filterMode="lenient"` keeps matching descendants' parents visible; custom `filterFunction`s handle the derived measurement-type and array-valued labels columns; table wrapper set to `overflow: visible` so the `MultiSelectFilter` dropdown is not clipped
- [x] `IngredientSelector` (`TreeSelect`) panel restyle — properly sized search/close/toggler SVG icons (PrimeReact `.p-icon` defaults to `1rem` and squishes in flex containers), repositioned magnifying-glass icon, indented child tree nodes; `MultiSelectFilter` option checkboxes no longer stretched by the global `input { width: 100% }` rule
- [x] React Router v7 Framework mode — `@react-router/dev/vite` plugin replaces `@vitejs/plugin-react` in Vite config; `root.tsx` is the new HTML shell + auth gate + nav layout (replaces `App.tsx`); `routes.ts` defines all routes explicitly; route components in `src/routes/` delegate to page components via `useOutletContext<RootContext>()`; `RecipeEditor` exported from `RecipeEditorPage` for direct use by `/recipes/:id` and `/recipes/:id/v/:vid` deep-link routes; `NavMenu` replaced button callbacks with `<Link>` components and `onBlur` blur-to-close; `UserMenu` also closes on blur

---

## In Progress

_(none)_

---

## Completed

- [x] Document separation: kitchenware (ingredients, containers, labels) and recipes/folders are now separate Y.Doc instances (`useKitchenwareDoc` + `KitchenwareDocContext` and `useRecipeBookDoc` + `RecipeBookDocContext`)
- [x] Branded `UserId`, `RecipeBookId`, `RecipeBookName` types in shared package; `snakeCaseName` unbranded arktype (trims + normalizes to snake_case via `string-ts` `snakeCase`, brandable for different types)
- [x] Server storage layer: `DocumentStore` interface with three backends — `LocalMemoryStore` (in-memory Map, default for tests), `LocalFileStore` (filesystem, `./data/{bookId}.yjs`), `NetlifyBlobStore` (Netlify Blobs, store `"recipe-books"`, key `book-{bookId}`)
- [x] `POST /sync` updated: removed `:user_id` URL param; body is now `{ book_id: string, update?: string }`; loads/saves through `DocumentStore` interface
- [x] Server config via `arkenv`: `PORT`, `STORAGE_ENGINE` (`'local-memory' | 'local-file' | 'netlify-blobs'`), `NETLIFY_PROJECT_ID`
- [x] Fixed Vite version hoisting: added `vite@^8.0.10` to root `devDependencies` so `@react-router/dev` resolves vite 8 (which has `isRunnableDevEnvironment`) instead of vite 5 (from vitest's dependency tree)

---

## Future Development Goals

- Re-implement per-item notes (attach notes to sections, ingredients, instructions, text blocks) — temporarily removed; see `recipe-editor-ingredient-selector` branch
- Offline-first PWA support (service worker)
- Hardware display target: Waveshare 7.5" e-paper + Raspberry Pi Pico 2
- Multi-user collaboration (shared Yjs documents)
- Nutrition data integration
- AI-assisted recipe scaling suggestions
- Export to PDF / print view
