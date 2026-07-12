import { type } from "arktype";
import type * as Y from "yjs";
import { isTypeError } from "../assertions/index.ts";
import { loadId, randomId } from "../types/ids.ts";
import type { Fraction, Measurement } from "../types/measurement.ts";
import { RecipeId, RecipeVersionId } from "../types/recipe.ts";
import { type ItemState, type Session, SessionId, SessionStatus } from "../types/session.ts";

const MAP_KEY = "sessions";

export function getSessionYmap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(MAP_KEY);
}

// ---------------------------------------------------------------------------
// Stored shape validation (mirrors recipeStore: top-level shape via ArkType,
// nested item states validated structurally).
// ---------------------------------------------------------------------------

const StoredSession = type({
  recipe_id: "string",
  recipe_version_id: "string",
  started_at: "number",
  "completed_at?": "number",
  status: SessionStatus.type,
  item_states: "object",
  "rescale_multiplier?": "unknown",
  "rating?": "number",
  "session_notes?": "string",
});

function validateItemState(raw: unknown): ItemState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r["checked"] !== "boolean") return null;
  return {
    checked: r["checked"],
    ...(typeof r["skipped"] === "boolean" && { skipped: r["skipped"] }),
    ...(r["one_off_quantity"] !== undefined && {
      one_off_quantity: r["one_off_quantity"] as Measurement,
    }),
    ...(typeof r["notes"] === "string" && { notes: r["notes"] }),
  };
}

function validateStored(id: SessionId, raw: unknown): Session | null {
  const result = StoredSession(raw);
  if (isTypeError(result)) return null;

  const item_states: Record<string, ItemState> = {};
  for (const [itemId, state] of Object.entries(result.item_states)) {
    const validated = validateItemState(state);
    if (validated !== null) item_states[itemId] = validated;
  }

  return {
    id,
    recipe_id: loadId(RecipeId, result.recipe_id),
    recipe_version_id: loadId(RecipeVersionId, result.recipe_version_id),
    started_at: result.started_at,
    status: result.status,
    item_states,
    ...(result.completed_at !== undefined && { completed_at: result.completed_at }),
    ...(result.rescale_multiplier !== undefined && {
      rescale_multiplier: result.rescale_multiplier as Fraction,
    }),
    ...(result.rating !== undefined && { rating: result.rating }),
    ...(result.session_notes !== undefined && { session_notes: result.session_notes }),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** All sessions, most recently started first. Completed sessions are never auto-deleted. */
export function getSessions(doc: Y.Doc): Session[] {
  const map = getSessionYmap(doc);
  const results: Session[] = [];
  map.forEach((value, id) => {
    const session = validateStored(loadId(SessionId, id), value);
    if (session !== null) results.push(session);
  });
  return results.sort((a, b) => b.started_at - a.started_at);
}

export function getSession(doc: Y.Doc, id: SessionId): Session | null {
  return validateStored(id, getSessionYmap(doc).get(id));
}

export function createSession(
  doc: Y.Doc,
  recipe_id: RecipeId,
  recipe_version_id: RecipeVersionId,
): Session {
  const session: Session = {
    id: randomId(SessionId),
    recipe_id,
    recipe_version_id,
    started_at: Date.now(),
    status: "active",
    item_states: {},
  };
  getSessionYmap(doc).set(session.id, session);
  return session;
}

function requireSession(doc: Y.Doc, session_id: SessionId): Session {
  const session = getSession(doc, session_id);
  if (session === null) throw new Error(`Session ${session_id} not found`);
  return session;
}

/**
 * Merges a partial state into one item's state (creating it as unchecked
 * when missing) and writes the updated session back.
 */
export function updateSessionItemState(
  doc: Y.Doc,
  session_id: SessionId,
  item_id: string,
  patch: Partial<ItemState>,
): Session {
  const session = requireSession(doc, session_id);
  const existing = session.item_states[item_id] ?? { checked: false };
  const updated: Session = {
    ...session,
    item_states: { ...session.item_states, [item_id]: { ...existing, ...patch } },
  };
  getSessionYmap(doc).set(session_id, updated);
  return updated;
}

/**
 * Marks the session completed, recording the completion time. Items in
 * `all_item_ids` that were neither checked nor skipped are marked skipped so
 * the summary can offer to remove or restore them.
 */
export function completeSession(
  doc: Y.Doc,
  session_id: SessionId,
  all_item_ids: readonly string[],
): Session {
  const session = requireSession(doc, session_id);
  const item_states: Record<string, ItemState> = { ...session.item_states };
  for (const itemId of all_item_ids) {
    const state = item_states[itemId] ?? { checked: false };
    if (!state.checked && state.skipped !== true) {
      item_states[itemId] = { ...state, skipped: true };
    }
  }
  const updated: Session = {
    ...session,
    status: "completed",
    completed_at: Date.now(),
    item_states,
  };
  getSessionYmap(doc).set(session_id, updated);
  return updated;
}
