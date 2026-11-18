/**
 * Transaction origins for Yjs writes that are not user edits.
 *
 * `Y.UndoManager` only tracks the `null` origin by default, so writes made with one of these
 * origins can never be undone — an Undo must not remove migrated data or the default kitchenware.
 */

/** Data copied in from an older storage layout (e.g. the pre-1a `kitchenware-*` / `recipes-*` docs). */
export const MIGRATION_ORIGIN = "migration" as const;
