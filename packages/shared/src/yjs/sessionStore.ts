import { type } from "arktype";
import type * as Y from "yjs";
import { isTypeError } from "../assertions/index.ts";
import { loadId, randomId } from "../types/ids.ts";
import type { Fraction, Measurement } from "../types/measurement.ts";
import { RecipeId, RecipeVersionId } from "../types/recipe.ts";
import { type ItemState, type Session, SessionId, SessionStatus } from "../types/session.ts";

const SESSIONS_KEY = "sessions";
const ITEM_STATES_KEY = "session_item_states";

export function getSessionYmap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(SESSIONS_KEY);
}

export function getItemStatesYmap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(ITEM_STATES_KEY);
}

function itemStateKey(session_id: string, item_id: string): string {
  return `${session_id}/${item_id}`;
}

// ---------------------------------------------------------------------------
// Stored shape validation — item_states stored in a separate map so that
// concurrent updates to different items merge at the CRDT entry level
// instead of racing on the whole session object.
// ---------------------------------------------------------------------------

const StoredSession = type({
  recipe_id: "string",
  recipe_version_id: "string",
  started_at: "number",
  "completed_at?": "number",
  status: SessionStatus.type,
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

/** Validate the session-level fields. Does NOT load item_states. */
function validateStored(id: SessionId, raw: unknown): Omit<Session, "item_states"> | null {
  const result = StoredSession(raw);
  if (isTypeError(result)) return null;

  return {
    id,
    recipe_id: loadId(RecipeId, result.recipe_id),
    recipe_version_id: loadId(RecipeVersionId, result.recipe_version_id),
    started_at: result.started_at,
    status: result.status,
    ...(result.completed_at !== undefined && { completed_at: result.completed_at }),
    ...(result.rescale_multiplier !== undefined && {
      rescale_multiplier: result.rescale_multiplier as Fraction,
    }),
    ...(result.rating !== undefined && { rating: result.rating }),
    ...(result.session_notes !== undefined && { session_notes: result.session_notes }),
  };
}

/** Load item states from the separate map for a given session. */
function loadItemStates(doc: Y.Doc, session_id: string): Record<string, ItemState> {
  const map = getItemStatesYmap(doc);
  const prefix = `${session_id}/`;
  const states: Record<string, ItemState> = {};
  map.forEach((value, key) => {
    if (typeof key === "string" && key.startsWith(prefix)) {
      const itemId = key.slice(prefix.length);
      const validated = validateItemState(value);
      if (validated !== null) states[itemId] = validated;
    }
  });
  return states;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** All sessions, most recently started first. Completed sessions are never auto-deleted. */
export function getSessions(doc: Y.Doc): Session[] {
  const sessionsMap = getSessionYmap(doc);
  const results: Session[] = [];
  sessionsMap.forEach((value, id) => {
    const base = validateStored(loadId(SessionId, id), value);
    if (base !== null) {
      results.push({ ...base, item_states: loadItemStates(doc, id) });
    }
  });
  return results.sort((a, b) => b.started_at - a.started_at);
}

export function getSession(doc: Y.Doc, id: SessionId): Session | null {
  const raw = getSessionYmap(doc).get(id);
  const base = validateStored(id, raw);
  if (base === null) return null;

  const item_states = loadItemStates(doc, id);

  // Backward compat: old sessions that stored item_states inline in the
  // session entry. Only fall back when the new map is empty for this session.
  if (Object.keys(item_states).length === 0 && typeof raw === "object" && raw !== null) {
    const stored = raw as Record<string, unknown>;
    const inline = stored["item_states"];
    if (typeof inline === "object" && inline !== null) {
      for (const [itemId, state] of Object.entries(inline as Record<string, unknown>)) {
        const validated = validateItemState(state);
        if (validated !== null) item_states[itemId] = validated;
      }
    }
  }

  return { ...base, item_states };
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
  // Only session-level fields go in the sessions map; item_states are stored
  // separately via updateSessionItemState.
  getSessionYmap(doc).set(session.id, {
    recipe_id: session.recipe_id,
    recipe_version_id: session.recipe_version_id,
    started_at: session.started_at,
    status: session.status,
  });
  return session;
}

function requireSession(doc: Y.Doc, session_id: SessionId): Session {
  const session = getSession(doc, session_id);
  if (session === null) throw new Error(`Session ${session_id} not found`);
  return session;
}

/**
 * Merges a partial state into one item's state (creating it as unchecked
 * when missing). Writes only the affected item's entry in the item states
 * map so concurrent updates to different items do not race.
 */
export function updateSessionItemState(
  doc: Y.Doc,
  session_id: SessionId,
  item_id: string,
  patch: Partial<ItemState>,
): Session {
  requireSession(doc, session_id);
  const map = getItemStatesYmap(doc);
  const key = itemStateKey(session_id, item_id);
  const existingRaw = map.get(key);
  const existing: ItemState =
    existingRaw !== undefined
      ? (validateItemState(existingRaw) ?? { checked: false })
      : { checked: false };
  map.set(key, { ...existing, ...patch });
  return getSession(doc, session_id)!;
}

/**
 * Marks the session completed, recording the completion time. Items in
 * `all_item_ids` that were neither checked nor skipped are marked skipped so
 * the summary can offer to remove or restore them.
 *
 * Session-level fields (status, completed_at) are updated in the sessions
 * map entry, while each item state is written as an individual entry in the
 * item states map — preventing concurrent item updates from being lost.
 */
export function completeSession(
  doc: Y.Doc,
  session_id: SessionId,
  all_item_ids: readonly string[],
): Session {
  requireSession(doc, session_id);

  doc.transact(() => {
    const itemStatesMap = getItemStatesYmap(doc);
    const prefix = `${session_id}/`;

    for (const itemId of all_item_ids) {
      const key = prefix + itemId;
      const existingRaw = itemStatesMap.get(key);
      const state: ItemState =
        existingRaw !== undefined
          ? (validateItemState(existingRaw) ?? { checked: false })
          : { checked: false };
      if (!state.checked && state.skipped !== true) {
        itemStatesMap.set(key, { ...state, skipped: true });
      }
    }

    // Update session-level fields.
    const sessionsMap = getSessionYmap(doc);
    const raw = sessionsMap.get(session_id);
    const base = validateStored(session_id, raw);
    if (base === null) throw new Error(`Session ${session_id} not found`);
    sessionsMap.set(session_id, {
      ...base,
      status: "completed",
      completed_at: Date.now(),
    });
  });

  return getSession(doc, session_id)!;
}
