# Recipe Book — Project Summary

## Overview

A local-first single-page web app for creating and managing recipes, with optional cloud sync. Built on Yjs for real-time collaborative state, with an e-ink inspired aesthetic (2D wireframe, handwritten style) and touch/click-first interactions.

---

## Architecture

### Monorepo Structure (3 npm sub-projects)

```
recipe-book/
├── packages/
│   ├── shared/        # Yjs models, types, operations — shared by web & server
│   ├── web/           # Vite + React SPA (y-indexeddb for local persistence)
│   │   └── public/
│   │       └── kitchenware.csv   # Static asset: default kitchenware (served by Vite)
│   └── server/        # Node.js sync server (Yjs document store per user)
├── CLAUDE.md
└── PROJECT_SUMMARY.md
```

### State & Sync

- **Local persistence:** `y-indexeddb` (browser IndexedDB)
- **Cross-browser sync:** Optional Node.js server; URL configurable via Vite env var (`VITE_SYNC_SERVER_URL`) stored in localStorage
- **Server:** Single `/sync` endpoint exchanges Yjs updates for a user's document and sends back updates to the default kitchenware list
- **Conflict resolution:** On kitchenware conflicts, user is prompted to accept incoming, keep local, or rename local and accept incoming

---

## Data Models (Yjs)

### Kitchenware

Kitchenware (ingredients, containers, equipment) lives in a global shared list with defaults shipped as a CSV static asset (`packages/web/public/kitchenware.csv`). On page load, if IndexedDB is empty, `use_ingredient_store` fetches `/kitchenware.csv`, parses it via `parse_kitchenware_csv`, and calls `init_from_kitchenware_templates` to populate the Yjs doc.

**CSV columns:** `Unique ID` (left-padded to 12 chars with `"-"`), `Type`, `Description`, `Default Measurement Type`, `Labels` ("+"-separated)

#### ItemLabel
- `id`: `ItemLabelId` (branded nanoid, 7 chars)
- `name`: string
- `kinds`: `ReadonlySet<ItemKind>` — which item types this label applies to

Labels are stored in the `"labels"` Yjs map on the document root. Deleting a label cascades to remove it from all ingredient label sets (via Yjs observer in `use_label_store`). Merging replaces multiple old IDs with a single new ID transactionally.

#### Ingredient
- `id`: `IngredientId` (branded nanoid, 12 chars)
- `name`: string
- `default_measurement_type`: `"volume" | "weight" | "count"`
- `labels`: `ReadonlySet<ItemLabelId>` (stored as `string[]` in Yjs, reconstructed as Set on read)
- `parent_id?`: `IngredientId` (supports subtypes; e.g. "Shredded Cheddar" → "Shredded Cheese" → "Cheese")

#### Container
- `id`: `ContainerId` (branded nanoid, 12 chars)
- `name`: string (bowl, steamer, pot, aluminium foil, etc.)
- `labels`: `ReadonlySet<ItemLabelId>`

#### Equipment
- `id`: `EquipmentId` (branded nanoid, 12 chars)
- `name`: string (oven, stove, etc.)
- `labels`: `ReadonlySet<ItemLabelId>`

**Branded IDs** use `ts-brand` phantom types (`Brand<string, "IngredientId">`) for compile-time type safety. Namespace+interface merging enables the `IngredientId` dot notation. Named IDs are left-padded to 12 chars with `"-"` (ASCII 45, below all nanoid chars) so they sort before random IDs.

### Recipe

- `id`: string
- `name`: string (non-unique)
- `description`: string
- `parent_group_id?`: string
- `versions`: RecipeVersion[] (append-only)
- `created_at`: timestamp
- `updated_at`: timestamp

#### RecipeVersion
A snapshot of a recipe's ingredients, containers, and instructions at a point in time.

- `id`: string
- `recipe_id`: string
- `items`: RecipeItem[] — ordered list of:
  - `IngredientItem` — ingredient ref, quantity (Measurement), notes
  - `ContainerItem` — container ref, nested IngredientItems, notes
  - `SectionLabel` — groups following items by label (liquid, solid, etc.)
  - `InstructionBlock` — paragraph-length text (placed between ingredients)
  - `EquipmentInstruction` — equipment ref + instruction text (bake 20 min, etc.)

### Measurement

Always displayed as simplified integer + fraction. All operations preserve exact rational arithmetic.

```
{ value: Fraction, unit: MeasurementUnit }
```

`MeasurementUnit` belongs to a `MeasurementType` (`volume` | `weight`). Units can be converted within the same type.

### Session

An "active session" is a started recipe run:

- `id`: string
- `recipe_version_id`: string
- `started_at`: timestamp
- `completed_at?`: timestamp
- `item_states`: map of item id → `{ checked: boolean, one_off_quantity?: Measurement, notes?: string }`
- `rescale_multiplier?: Fraction`
- `rating?: number` (0–10, shown as 0–5 stars)
- `session_notes?: string`

### Recipe Group

- `id`: string
- `name`: string
- `parent_group_id?`: string
- `tags`: string[]
- `sort_order`: `"last_modified" | "created" | "alphabetical" | "manual"`
- `manual_order?`: string[] (recipe/group ids)

---

## UI Pages & Components

### Home Page
- Active sessions list: progress bar, estimated time left, percent complete (opens in new tab)
- Search bar: searches recipes, kitchenware, and groups

### Recipe Editor
- Edit name and description
- Add/edit ingredients (with measurement editor)
- Add/edit containers (bowl, steamer, pot, foil) containing nested ingredients
- Add/edit equipment instructions (bake 20 min, sear on high, mix 20 min, etc.)
- Add section labels to bulk-group ingredients/containers
- Auto-grouping by liquid vs. solid
- Insert paragraph-length instruction blocks between items
- Attach notes to ingredients or instructions
- View past versions (version history)
- Clone and name a new recipe
- View session log
- Choose a parent group

### Active Session View
- Ingredients and containers as checkboxes (nested for containers)
- Checking a container does not auto-check its contents
- "±" button per ingredient opens the measurement value editor:
  - After any button press, replaced by a visual slider with "-"/"+" buttons
  - "OK" to accept, "Rescale" to open bulk rescale interface with current one-off adjustments
- Attach notes to ingredients, containers, or sections
- Marks session complete

### Bulk Rescale Interface
- "Rescale multiplier" input (uses measurement editor component)
- "Include one-off adjustments" checkbox (unchecked by default; when checked, resets one-offs to `original × multiplier`)
- Can open with pre-filled one-off adjustments
- "Rescale to adjusted amount" button per ingredient (sets multiplier to ratio of one-off ÷ original)
- Additional one-off adjustment inputs (reuses active session one-off component)
- "Cancel" / "Accept" buttons

### Edit Past Session
- 5-star (0–10) rating
- Attach notes
- Update existing recipe with a new version using session measurements
- Clone and name a new recipe from the session

### Measurement Value Editor (shared component)
1. Display: `${integer}<sup>${num}</sup>⁄<sub>${denom}</sub>`
2. Radio buttons: ➗ / × / − / + (opens one of 4 button rows):
   - ➗2, ➗3, ➗5
   - ×2, ×3, ×5
   - −1, −½, −⅓, −⅕, −⅛
   - +⅛, +⅕, +⅓, +½, +1
3. "OK" — accepts value; if a measurement unit, converts to largest evenly-dividing unit
4. "<" — resets to value before editor opened
- Unit selector: radio/select for all units of the same measurement type

### Bulk Ingredient Editor
- Search/filter by label, default measurement type, or parent type
- Multi-select checkboxes
- Bulk actions: add label, remove label, change measurement type, change parent ingredient
- "Add new ingredient" form
- "Refresh filter" link when changes invalidate the current filter

### Recipe Group Editor (Directory View)
- Breadcrumb navigation back to root
- Recursive filter by name (shows full parent-chain to matches)
- Add tags to current group or to recipes/subgroups
- Sort by last modified, date created, or alphabetical
- Manual drag-and-drop reorder
- Per-item buttons: edit recipe, expand versions, expand subgroup

### Recipe Import
- URL input → scrape page content (strip ads, extract text + links)
- Local AI processes scraped content into ingredients, containers, instructions, text blocks
- Review and confirm before saving

### Top Nav Bar
- "☰" hamburger menu to navigate between pages
- "↩ Undo" button (Yjs undo manager)

---

## Design System

- **Aesthetic:** 2D wireframe / handwritten style, e-ink white background
- **Interactions:** Touch/click first
- **Layout:** Responsive — no horizontal scrolling; maximize horizontal space at all screen sizes
- **Styling:** CSS-only (no JS layout), `vw` units for widths (except relative font sizes use `em`)
- **Fractions:** Always simplified; displayed as integer + proper fraction superscript/subscript

---

## Testing Architecture

- **Unit tests:** Vitest — all models, operations, and utility functions
- **Component tests:** Vitest + React Testing Library — all view components
- **Typecheck:** `tsc --noEmit`
- **Lint:** ESLint + Prettier

Run order before every commit:
```
npm run typecheck
npm test
npm run lint
```

---

## Completed Features

- [x] Monorepo scaffold (npm workspaces: shared, web, server)
- [x] Yjs data models in `shared` (Kitchenware, Recipe, Session, RecipeGroup, Measurement types with kind discriminators)
- [x] Measurement fraction arithmetic (simplify, add, subtract, multiply, divide) with exact rational representation
- [x] Unit conversion tables (US customary volume/weight and metric, exact within each system)
- [x] Default kitchenware CSV static asset (`packages/web/public/kitchenware.csv`) with 11 ingredients, 5 containers, 3 equipment; IDs left-padded to 12 chars with `"-"`; fetched and loaded by `use_ingredient_store` on first page load if IndexedDB is empty
- [x] Vite + React 19 web app scaffold with e-ink CSS design system
- [x] Node.js + Express 5 sync server with Yjs document store endpoint
- [x] User selection (first-load page, localStorage persistence, per-user Yjs doc via y-indexeddb)
- [x] Top nav bar: hamburger NavMenu, Undo button, UserMenu with profile settings link
- [x] ProfileSettingsPage (rename user, persists to localStorage)
- [x] Yjs ingredient CRUD store (`shared`) — init from defaults, add/remove labels, set type/parent, rename, set labels
- [x] `use_ingredient_store` hook + DocContext (React)
- [x] Ingredients Page — TanStack Table v8 tree view (expandable parent→child), column filters (recursive fuzzy name filter with auto-expand; multi-select checkbox dropdown for type/labels), sortable columns, groupable columns, inline editable cells (click to edit, Enter/Escape hotkeys, ✔︎/✗ confirm/cancel), row checkboxes with select-all, bulk action bar (add/remove labels, change type, change parent), `+ New ingredient` form
- [x] `ItemLabel` type with branded `ItemLabelId` (7-char nanoid); `ItemKind`-scoped labels stored in `"labels"` Yjs map
- [x] Branded IDs for all item types via `ts-brand` + TypeScript declaration merging (`IngredientId`, `ContainerId`, `EquipmentId`, `ItemLabelId`)
- [x] `label_store.ts` — Yjs CRUD (add, find, rename, delete, find-or-create); `use_label_store` React hook with cascade-delete observer and transactional merge
- [x] `LabelTable` expandable panel — multi-select checkboxes, bulk actions (Filter All, Filter Any, Delete, Merge with name prompt), inline rename; shown above `IngredientsTable` on the Bulk Ingredient Editor page
- [x] External label filter: selecting labels in `LabelTable` and clicking Filter All/Any updates a filter passed to `IngredientsTable` that pre-filters ingredients before tree-building
- [x] ArkType v2 schemas replace manual validation in `ingredient_store.ts` and `label_store.ts`; `MeasurementType` exported as both ArkType schema value and TypeScript type alias from `measurement.ts`
- [x] PapaParse replaces hand-written CSV parser in `parse_kitchenware_csv.ts`; per-kind ArkType schemas (`IngredientRow`, `ContainerRow`, `EquipmentRow`) with pipe morphs for "+" delimited label fields
- [x] `LabelEditor` component (`react-select` `CreatableSelect isMulti`) — add/remove existing labels from a dropdown or type to create a new one; replaces the plain text-input in the `IngredientsTable` Labels cell editor; cancel via ✗ button or Escape (when dropdown is closed)

---

## In Progress

_(none)_

---

## Future Development Goals

- Offline-first PWA support (service worker)
- Hardware display target: Waveshare 7.5" e-paper + Raspberry Pi Pico 2
- Multi-user collaboration (shared Yjs documents)
- Nutrition data integration
- AI-assisted recipe scaling suggestions
- Export to PDF / print view
