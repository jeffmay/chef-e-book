# Project: Recipe Book

## Project Description

A local-first single-page web app for creating and managing recipes, with optional cloud sync. Built on Yjs for real-time collaborative state, with a greyscale e-ink compatible UI and aesthetic (2D wireframe, handwritten style), optimized for the 1404 x 1872 pixel screen of the [PineNote](https://pine64.org/devices/pinenote/) using greyscale e-ink tablet, focused on touch/click interactions using a stylus over a physical keyboard and supporting black & white with dithering mode for optimal performance.

## Code Conventions

- Prettier for formatting
- ESLint for linting
- Functional components with hooks for React
- Companion objects to define named and branded `arktype` schemas
- Use `ReadonlyDeep<*>` for all input types whenever possible
  - React props types should always be defined as `ReadonlyDeep<{...}>`.
  - Use `type *Props = ReadonlyDeep<{...}>` over `interface *Props { ... }` except for `*Store` types returned from `use*Store` functions.
  - Non-props type `X` should be defined as mutable and functions should always take `ReadonlyDeep<X>` as input.
  - Functions that return types should always return them as mutable when possible.
- Optimize for the 1404 x 1872 pixel e-ink screen of the PineNote in Black & White mode with dithering
  - Never use animations
  - Text should only be full black or white (not grey)
  - Avoid placeholder text
  - Backgrounds can use grey (rendered with dithered dots), but should favor solid black or white
  - Always leave at least 468 pixels of blank space for the on-screen keyboard at the bottom of every page
- 2-space indentation
- Naming:
  - TitleCase for components, classes, and enum type names
  - camelCase for function names (including hooks, event handlers, and utility functions)
  - snake_case for data: object/interface field names, Yjs map keys

## Developer Setup

First-time setup (installs external tools like `graphify`):

```
npm install
npm run setup
```

`npm run setup` runs `scripts/setup.sh`, which installs `uv` (if missing) and then `uv tool install graphifyy`. The `graphify` command is used to maintain the knowledge graph at `graphify-out/`.

## Common Development Tasks

Run the following in order before every commit:

```
npm run typecheck     # Typecheck all files
npm test              # Run all tests
npm run format        # Run the autoformatter on all files
npm run lint          # Run the linter on all files
graphify update .     # Update the /graphify-out directory after changes
```

The app is running at http://localhost:5173, and you can use the Playwright MCP to access it.

## Rules

- ALWAYS use relative paths over absolute paths to avoid needing to prompt me for access.
- MUST ALWAYS run `npm run typecheck`, `npm test`, `npm run format`, `npm run lint`, and then `graphify update .` for all files before commiting code changes.
  (This is handled automatically by husky pre-commit-msg hook)
- MUST NEVER commit changes to the `main` branch.
- MUST ALWAYS commit all completed work to a kabob-case named feature branch with a comprehensive git commit message using [gitmoji](https://gitmoji.dev/) where applicable.
- MUST ALWAYS keep CLAUDE.md up-to-date with file structure, architecture, testing, and data models.
- MUST ALWAYS keep PROJECT_SUMMARY.md up-to-date with any changes to completed features and future development goals.
- MUST ALWAYS write unit tests for all changes.
- MUST NEVER skip unit tests using early returns. Instead, ALWAYS provide a test fixture with values that meet the test pre-conditions when initializing the game state or throw something on unexpected state to satisfy the type checker.
- MUST ALWAYS write component tests for all view changes.
- MUST NEVER leave React "not wrapped in act(...)" warnings in tests. When rendering doc-backed hooks/components, flush mount-time async state updates inside `act(...)` (e.g. `await flushAsyncEffects()` from `src/testUtils.ts`), and wrap any mid-test external Yjs mutations in `act(() => ...)`. See [Flushing async state updates inside `act(...)`](#flushing-async-state-updates-inside-act) under Testing Architecture.
- MUST NEVER use the `as` keyword to cast a type without validating every field in the type.
- MUST ALWAYS use `Companion` (or subclass) constants with the same name as the `type` and an `arktype` schema that is used to derive the type definition (using `typeof X.type.infer`).
- MUST ALWAYS use `arktype` for runtime validation over hand-rolled validation functions.
- MUST NEVER use the `in` keyword to test for the existance of a property on a union type. Instead, use the proper type union discriminator field to narrow the type to the desired type or interface.
- MUST NEVER use the `any` type. Instead, try your best to define a strict generic type. If you are adding type information to something that does not allow passing the type information along (such as deserialization or APIs that return untyped data), then use a specific function to validate and cast the object as the expected / provided type. Or, as a last resort, use the `unknown` type instead.
- MUST ALWAYS use `ReadonlyDeep<*>` for function inputs unless it would be meaningless.
- MUST ALWAYS use double quotes ("") for constant strings, unless the string itself contains double quotes, in which case, you should use single quotes ('"'), unless the string contains both double and single quotes, in which case use backticks (`"''"`).
- MUST ALWAYS use responsive design to ensure that the elements never require horizontal scrolling, while maximizing use of horizontal space for mobile device, tablet, laptop, and wide screens.
- MUST ALWAYS use CSS over JavaScript for styling elements.
- MUST ALWAYS use `vw` units unless the element is a horizontal line or when creating a font-size that is relative to a sibling or parent element, in which case, `em` is fine.
- MUST ALWAYS use camelCase for React component props, local variables, and constant references. Keep snake_case for all fields stored in Yjs documents, and any string values such as discriminator fields (e.g. `"measurement_type"`).
- MUST ALWAYS use `fixedId` for creating deterministic IDs in test files instead of string literals or casting.
- MUST ALWAYS use `loadId` when loading existing IDs from stored data instead of using the `as` keyword to cast strings to branded ID types.

## Architecture

### Monorepo Structure (3 npm sub-projects)

```
recipe-book/
├── packages/
│   ├── shared/        # Yjs models, types, operations — shared by web & server
│   ├── web/           # Vite + React Router (Framework mode) SPA
│   │   ├── react-router.config.ts   # appDirectory: "src", ssr: false
│   │   ├── e2e/                     # E2E tests + PlayWright
│   │   └── public/
│   │       └── kitchenware.csv      # Static asset: default kitchenware (served by Vite)
│   │   └── src/
│   │       ├── entry.client.tsx  # Client bootstrap (HydratedRouter)
│   │       ├── root.tsx          # Root layout (HTML shell) + auth gate + nav shell
│   │       ├── routes.ts         # Route definitions (React Router Framework mode)
│   │       └── routes/           # Route components
│   │           ├── index.tsx                              # / → redirect to /dashboard
│   │           ├── dashboard.tsx                          # /dashboard
│   │           ├── ingredients.tsx                        # /ingredients
│   │           ├── recipes.tsx                            # /recipes (list + inline new)
│   │           ├── recipes.new.tsx                        # /recipes/new
│   │           ├── recipes.$recipe_id.tsx                 # /recipes/:recipe_id
│   │           ├── recipes.$recipe_id.v.$version_id.tsx   # /recipes/:recipe_id/v/:version_id
│   │           ├── sessions.$session_id.tsx               # /sessions/:session_id
│   │           └── profile.tsx                            # /profile
│   └── server/        # Node.js sync server (Yjs document store per user)
├── AGENTS.md
└── PROJECT_SUMMARY.md
```

### Routing (React Router v7 — Framework Mode)

The app uses **React Router v7 in Framework mode** via `@react-router/dev/vite` Vite plugin.

- **`root.tsx`** — exports `Layout` (HTML shell) and the default `Root` component (auth gate + nav). Authenticated users see the nav bar + `<Outlet>` with outlet context `{ userName, onRename }`.
- **`routes.ts`** — explicit route definitions using `index()`/`route()` helpers.
- **Route components** — thin wrappers that read `useOutletContext<RootContext>()` for `userName`/`onRename`, then delegate to page components.
- **`RecipeEditorPage`** at `/recipes` — still uses internal state for list↔editor transitions. `RecipeEditor` is exported for direct use by `/recipes/:id` and `/recipes/:id/v/:vid` routes.
- **NavMenu** — uses `<Link>` components (no `onNavigate` callback); closes on blur via `onBlur`+`focusout`.
- **UserMenu** — closes on blur via same pattern.

### State & Sync

- **Local persistence:** `y-indexeddb` (browser IndexedDB)
- **Cross-browser sync:** Optional Node.js server; URL configurable via Vite env var (`VITE_SYNC_SERVER_URL`) stored in localStorage
- **Server:** Single `/sync` endpoint exchanges Yjs updates for a user's document and sends back updates to the default kitchenware list
- **Conflict resolution:** On kitchenware conflicts, user is prompted to accept incoming, keep local, or rename local and accept incoming

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
- `default_measurement_value`: `Measurement` — a full value like `{ value: {1,1}, unit: "cup" }` (migrated from old `default_measurement_type`)
- `labels`: `ReadonlySet<ItemLabelId>` (stored as `string[]` in Yjs, reconstructed as Set on read)
- `parent_id?`: `IngredientId` (supports subtypes; e.g. "Shredded Cheddar" → "Shredded Cheese" → "Cheese")

#### Container

- `id`: `ContainerId` (branded nanoid, 12 chars)
- `name`: string (bowl, steamer, pot, aluminium foil, etc.)
- `labels`: `ReadonlySet<ItemLabelId>`
- `parent_id?`: `ContainerId` (supports container hierarchies)

#### Equipment

- `id`: `EquipmentId` (branded nanoid, 12 chars)
- `name`: string (oven, stove, etc.)
- `labels`: `ReadonlySet<ItemLabelId>`

**Branded IDs** use `ts-brand` phantom types (`Brand<string, "IngredientId">`) for compile-time type safety. Namespace+interface merging enables the `IngredientId` dot notation. Named IDs are left-padded to 12 chars with `"-"` (ASCII 45, below all nanoid chars) so they sort before random IDs.

### Recipe

- `id`: `RecipeId` (branded nanoid, 12 chars)
- `title`: string
- `subtitle?`: string
- `source_url?`: string (URL format)
- `parent_folder_id?`: `RecipeFolderId`
- `versions`: `RecipeVersion[]` (append-only)
- `created_at`: timestamp
- `updated_at`: timestamp

#### RecipeVersion

A snapshot of a recipe's ingredients and sections at a point in time.

- `id`: `RecipeVersionId` (branded nanoid, 12 chars)
- `recipe_id`: `RecipeId`
- `description`: string (e.g. "Untested" or "Final Version")
- `ingredients`: `RecipeIngredient[]` — top-level ingredient list (ingredient_id + optional Measurement)
- `sections`: `Section[]` — ordered list of sections containing `SectionItem`s
- `estimated_time_seconds?`: number — overrides the computed estimate (instruction durations + per-ingredient time × ingredient count)
- `seconds_per_ingredient?`: number — per-ingredient prep time; resolution chain: version value → RecipeBook `book_settings` value → `VITE_DEFAULT_SECONDS_PER_INGREDIENT` build variable → 2-minute shared default (`DEFAULT_SECONDS_PER_INGREDIENT`)
- `created_at`: timestamp
- `created_by`: string

Estimation helpers live in `packages/shared/src/math/estimation.ts` (`minimumEstimatedSeconds`, `resolveEstimatedSeconds`, `computeItemWeights`, `progressFraction`); section walkers (`collectIngredientItems`, `collectInstructions`, `computeTopIngredients`, `removeSectionItemsById`) live in `packages/shared/src/types/sections.ts`.

#### SectionItem (recursive)

Sections contain `SectionItem[]`. Each item is one of:

- `IngredientItem` — ingredient ref, optional `amount` (Measurement), notes
- `ContainerItem` — container ref, `descriptor`, optional `ordered`, nested `IngredientItem[]`, notes
- `TextBlock` — freeform text, notes
- `Instruction` — instruction verb (mix/bake/stir), optional `equipment_id`, optional `ingredient_ids[]`, optional `duration_seconds`, notes
- `Section` — nested section with optional `header` and recursive `contents`

### Measurement

Always displayed as simplified integer + fraction. All operations preserve exact rational arithmetic.

```
{ value: Fraction, unit: MeasurementUnit }
```

`MeasurementUnit` belongs to a `MeasurementType` (`volume` | `weight`). Units can be converted within the same type.

### Session

An "active session" is a started recipe run. Stored in the `"sessions"` Yjs map (`packages/shared/src/yjs/sessionStore.ts`); completed sessions are never deleted automatically.

**Item states are stored separately** in the `"session_item_states"` Yjs map, keyed by `"<session_id>/<item_id>"`. Each item state is an individual entry so concurrent updates to different items merge at the CRDT entry level instead of racing on the whole session object. `getSessionYmap()` returns the sessions map; `getItemStatesYmap()` returns the item states map. The hook (`useSessionStore`) observes both maps for reactive updates. Old sessions with inline `item_states` in the session entry are still readable via backward-compat fallback in `getSession()`.

- `id`: `SessionId` (branded nanoid, 12 chars)
- `recipe_id`: `RecipeId`
- `recipe_version_id`: `RecipeVersionId`
- `started_at`: timestamp
- `completed_at?`: timestamp
- `status`: `"active" | "completed"`
- `item_states`: map of item id → `{ checked: boolean, skipped?: boolean, one_off_quantity?: Measurement, notes?: string }`
- `rescale_multiplier?: Fraction`
- `rating?: number` (0–10, shown as 0–5 stars)
- `session_notes?: string`

`completeSession` records `completed_at` and marks any item that is neither checked nor skipped as skipped, so the summary can offer to remove or keep it.

### Book Settings

Book-wide settings stored in the `"book_settings"` Yjs map (`packages/shared/src/yjs/bookSettingsStore.ts`). All values optional; a future settings page will edit them.

- `seconds_per_ingredient?`: number — book-level default per-ingredient prep time; falls back to the `VITE_DEFAULT_SECONDS_PER_INGREDIENT` build variable (parsed in `packages/web/src/config.ts`, default 120s). Resolved by the `useBookSettings` hook.

### Recipe Folder (formerly RecipeGroup)

Recursive tree structure for organizing recipes. Stored flat in `"recipe_folders"` Yjs map; tree built in-memory via `parent_folder_id` links.

- `id`: `RecipeFolderId` (branded nanoid, 12 chars)
- `name`: string
- `parent_folder_id?`: `RecipeFolderId` (supports arbitrary nesting)
- `tags`: string[]
- `sort_order`: `"last_modified" | "created" | "alphabetical" | "manual"`
- `manual_order?`: string[] (recipe/folder ids)
- `children?`: `RecipeFolder[]` (computed, not stored)

> Backward-compat aliases: `RecipeGroupId = RecipeFolderId`, `RecipeGroup = RecipeFolder`.

## UI Pages & Components

- All editor components use "↩" (cancel changes) and "✔︎" (accept changes) buttons in left-to-right order.
  If the horizontal screen space is needed, the buttons can be stacked from top-to-bottom.
- **`ButtonMenu`** (`components/button_menu/`) — shared split button: an optional `defaultButton` performs its action directly, and a "▾" chevron opens a PrimeReact popup `Menu` listing all available actions (PrimeReact `ButtonGroup` + `Menu`). When `defaultButton` is undefined only the chevron shows. The `hideDefault` prop hides the default button and folds its action to the top of the chevron menu (so only the "▾" trigger shows) — used to compact the actions column in mobile view. Used by the bulk recipe page rows, the folder "New" menus, and the version history table.
- **`useMobileView`** (`hooks/useMobileView.ts`) — returns whether the viewport is in "mobile view" (≤ `MOBILE_VIEW_MAX_WIDTH` = 600px), tracking `window.matchMedia` reactively (and defaulting to `false` where `matchMedia` is unavailable, e.g. jsdom). The 600px breakpoint is kept in sync with the `@media (max-width: 600px)` rules in page stylesheets.
- **`RecipeVersionEditor`** (`components/recipe_editor/`) — the editable body of a RecipeVersion (computed Ingredients display + recursive Instructions section editor). Shared by `RecipeEditor` and the session summary; optional `skippedIds`/`onRestoreItem`/`onDismissItem` decorate skipped items with the `--background-danger` stripes, a floating "skipped" tag, and Restore/✕ actions.

### Home Page

- Active sessions list: progress bar, estimated time left, percent complete (opens in new tab)
- Search bar: searches recipes, kitchenware, and groups

### Recipe Editor

- Edit name and description
- Required `title` and version `description` fields show a `*` indicator and the shared field-error styling when empty
- Choose/create a parent folder with `RecipeFolderSelector` (`TreeSelect` + a "New subfolder" checkbox that requires a name; the editor creates the folder then selects it)
- Add sections with an optional header (hidden until a `+ Add Section Header` button is clicked, which reveals and focuses the input)
- Add/edit ingredients (with measurement editor); each ingredient row in a section shows its own measurement value next to the name (independent of the aggregate Ingredients list)
- Add/edit containers (bowl, steamer, pot, foil) containing nested ingredients
- Add/edit equipment instructions (bake 20 min, sear on high, mix 20 min, etc.); each instruction picks the ingredients it acts on via `InstructionIngredientSelector` — a multi-select `TreeSelect` of the recipe's own ingredients grouped by container (containers hold only ingredients; add ingredients to a section/container to make them available)
- Add/edit text blocks
- Add/edit sub-sections
- Attach notes to any sections or section items
- Auto-grouping ingredients (ex: group by label - solid or liquid)
- Save as a new version (the "Create new version" checkbox clears the version description and focuses it)
- View past versions (version history); each row has a `ButtonMenu` — "Edit" is the default button (opens that version) with "Start" in the chevron menu
- "▶ Start" button in the header starts a session for the version being viewed (or the latest)
- Clone and rename recipe
- View session log
- Move to a parent group ("organize")

### Recipe Session Page (`/sessions/:session_id`)

`RecipeSessionPage` (`packages/web/src/pages/RecipeSessionPage.tsx`) renders a started session; started from the recipe editor (header + version table) or the bulk recipe page (recipe + version rows) via `useStartSession`.

**Run view** (`status: "active"`):

- Renders the version's sections in order: ingredients and instructions as checkbox rows with a Skip/Unskip toggle, containers as grouped nested ingredient lists, text blocks as plain text, sub-section headers by depth
- Checked rows disable Skip; skipped rows disable the checkbox and show a solid-black "skipped" tag with strikethrough
- Progress bar (black fill, no animation) weighted by `computeItemWeights`: each ingredient advances by the per-ingredient time; the remaining time budget (total − per-ingredient × count) is distributed across instructions in proportion to their durations (split evenly when none have durations); skipped items count as done
- Shows percent complete and approximate remaining time
- "✔︎ Complete" button at the end calls `completeSession`

**Summary view** (`status: "completed"`, also shown when revisiting an old completed session):

- Total (actual) time from `started_at` → `completed_at`
- The full `RecipeVersionEditor`, so new ingredients/sections can be added before saving; skipped items render in place with the `--background-danger` diagonal stripes and a floating centered "skipped" tag, plus a "Restore" button (puts the item back into the version) and a "✕" button (removes the row from view) — still-skipped items are removed from any saved version by default
- "Time per ingredient" `DurationEditor` (separated from its label by a vertical rule), defaulting to the resolved config for the session's version
- "Estimated total time" range slider, clamped to a minimum of instruction durations + per-ingredient time × ingredient count over the _kept_ items (recomputed on restore/dismiss and per-ingredient time changes)
- Required version description (shared field-error styling)
- Actions: "Create a new version" (appends to the same recipe with the adjusted time fields), "Create a new recipe" (uses the prefilled new-recipe title input), "Discard recipe version" (navigates away; the completed session is still kept)

### Active Session View (planned — extends the Recipe Session Page)

- Ingredients and containers as checkboxes (nested for containers)
- Checking a container does not auto-check its contents
- "±" button per ingredient opens the measurement value editor:
  - After any button press, replaced by a visual slider with "-"/"+" buttons
  - "✔︎" to accept, "Rescale" to open bulk rescale interface with current one-off adjustments
- Attach notes to ingredients, containers, or sections
- Marks session complete

### Bulk Rescale Interface

- "Rescale multiplier" input (uses measurement editor component)
- "Include one-off adjustments" checkbox (unchecked by default; when checked, resets one-offs to `original × multiplier`)
- Can open with pre-filled one-off adjustments
- "Rescale to adjusted amount" button per ingredient (sets multiplier to ratio of one-off ÷ original)
- Additional one-off adjustment inputs (reuses active session one-off component)

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
3. "↩" — resets to value before editor opened
4. "✔︎" — accepts value; if a measurement unit, converts to largest evenly-dividing unit

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
- Recipe and version rows use a `ButtonMenu` — "▶ Start" is the default button (latest version on recipe rows, that version on version rows) with Start/Edit in the chevron menu
- Folder rows (and the virtual root) use a `ButtonMenu` — "New Recipe" is the default button with New Recipe / New Folder in the chevron menu
- **Mobile view** (`useMobileView`, ≤ 600px): the Created/Updated date columns are hidden via a `@media (max-width: 600px)` rule (leaving only Select, Name, and Actions), and every row's actions `ButtonMenu` sets `hideDefault` so only the "▾" trigger shows (its default action moves into the menu)

### Recipe Import

- URL input → scrape page content (strip ads, extract text + links)
- Local AI processes scraped content into ingredients, containers, instructions, text blocks
- Review and confirm before saving

### Top Nav Bar

- "☰" hamburger menu to navigate between pages
- "↩ Undo" button (Yjs undo manager)

## Design System

- **Aesthetic:** 2D wireframe, monospace font for input values, handwritten font for rendered output, black & white e-ink with white background, optimized for 1404 x 1872 pixel screen
- **Interactions:** Optimized for touch / click, but also supports 468px onboard keyboard at the bottom
- **Layout:** Responsive — no horizontal scrolling; maximize horizontal space at all screen sizes
- **Keyboard clearance:** Every page reserves blank space at the bottom for the on-screen keyboard via `global.css` — the `--keyboard-clearance: 468px` token plus `--spacing-lg`, applied to `.app > main` (all authenticated routes) and `main.select-user-page` (pre-auth book picker)
- **Mobile focus-zoom:** A `@media (max-width: 600px)` rule in `global.css` forces every focusable text input/textarea/select to `font-size: 16px !important`, preventing mobile browsers (notably iOS Safari) from auto-zooming on focus (they zoom whenever the focused control is below 16px). Excludes checkboxes/radios. Breakpoint matches `MOBILE_VIEW_MAX_WIDTH` in `useMobileView.ts`.
- **Styling:** CSS-only (no JS layout), `vw` units for widths (except relative font sizes use `em`)
- **Colors:** Text is only full black or white (no grey); `--color-muted` resolves to black. Placeholder text is avoided; any remaining placeholder/empty-state label renders full black (`::placeholder`, `.tree-select .p-treeselect-label.p-placeholder`)
- **Checkboxes:** Single source of truth in `global.css` — native `input[type="checkbox"]` (square, `accent-color` black, width reset from the global `input` rule) and the PrimeReact `.p-checkbox-box` (white box, solid-black with white check when its `.p-checkbox` wrapper gains `.p-highlight`). Shared by TreeSelect/TreeTable checkbox selection.
- **Fractions:** Always simplified; displayed as integer + proper fraction superscript/subscript
- **Form validation:** Reusable classes in `global.css` — `.field-required` (the `*` label indicator), `.field-input--error` (heavy black outline, not a red border), and `.field-error` (italic text prefixed with a `⚠` glyph). Shared across all forms.

## Testing Architecture

- **Unit tests:** Vitest — all models, operations, and utility functions
- **Component tests:** Vitest + React Testing Library — all view components
- **End-to-end tests:** Playwright - browser-dependent interaction testing and defect detection
- **Typecheck:** `tsc --noEmit`
- **Lint:** ESLint + Prettier

### Flushing async state updates inside `act(...)`

Doc-backed hooks/components (e.g. `useIngredientStore`, `useContainerStore`) schedule
state updates from promise callbacks that resolve **after** a synchronous test body
returns — the `whenSynced.then(() => setState(...))` re-read and the async CSV import
chain. When those `setState` calls land outside `act(...)`, React logs:

```
An update to <Component> inside a test was not wrapped in act(...).
```

To prevent this, every test that renders a doc-backed hook/component must flush those
pending updates inside `act(...)` before the test ends:

- **Synchronous, assertion-only tests** (no `await userEvent` / `findBy*`): make the test
  `async` and call `await flushAsyncEffects()` (from `src/testUtils.ts`) immediately after
  rendering — or render through an async helper that awaits it (see the `renderStore`
  helpers in the store tests).
- **Tests that already `await` an interaction** (`userEvent`, `findBy*`) flush implicitly,
  because those helpers run inside `act(...)`; no extra flush is needed.
- **External Yjs mutations made mid-test** (e.g. `deleteRecipe(doc, id)` to simulate a
  concurrent edit) fire store observers synchronously, so wrap the mutation itself in
  `act(() => ...)`.

`flushAsyncEffects()` awaits a `setTimeout(0)` macrotask inside `act(...)`, which fully
settles multi-step promise chains (`await whenSynced` → `await fetch` → `await text`).

### Naming Conventions

| Category                                       | Convention                    | Examples                                              |
| ---------------------------------------------- | ----------------------------- | ----------------------------------------------------- |
| Components, classes, enums                     | TitleCase                     | `RecipeEditorPage`, `SectionItem`, `SortOrder`        |
| Component file names                           | TitleCase                     | `RecipeEditorPage.ts`                                 |
| File names (non-component)                     | camelCase                     | `useRecipeStore.ts`                                   |
| Functions (hooks, handlers, utilities)         | camelCase                     | `useRecipeStore`, `handleSave`, `buildFolderTree`     |
| React component props                          | camelCase                     | `onChange`, `onSave`, `onCancel`, `initiallyOpen`     |
| Local variables                                | camelCase                     | `currentValue`, `filteredItems`                       |
| Constants, environment variable / config names | CONSTANT_CASE                 | `DEFAULT_MEASUREMENT_BY_TYPE`, `PORT`                 |
| Object / interface fields (Yjs-backed)         | snake_case                    | `recipe_id`, `created_at`, `parent_folder_id`         |
| Yjs map keys                                   | snake_case                    | `"recipe_folders"`, `recipe_store.ts`                 |
| String discriminator values (enum)             | snake_case                    | `"measurement_type"`, `"ingredient_item"`, `"volume"` |
| CSS classes (unless defined by 3rd party)      | kebab-case                    | `.re-editor`, `le__multi-value__remove`               |
| CSS file names                                 | TitleCase (matches component) | `DurationEditor.css` for `DurationEditor.tsx`         |

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
