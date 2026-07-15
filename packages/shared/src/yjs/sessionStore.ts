import { type } from "arktype";
import type * as Y from "yjs";
import { Companion } from "../types/companion.ts";
import { loadId, randomId } from "../types/ids.ts";
import type { Fraction } from "../types/measurement.ts";
import { RecipeId, RecipeVersionId } from "../types/recipe.ts";
import { ItemState, type Session, SessionId, SessionStatus } from "../types/session.ts";
import type { ValidationError } from "./validation.ts";
import { assertValid, isInvalid, isValid, validateByIdOrLog } from "./validation.ts";

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

const StoredSession = Companion(
  "StoredSession",
  type({
    recipe_id: "string",
    recipe_version_id: "string",
    started_at: "number",
    "completed_at?": "number",
    status: SessionStatus.type,
    "rescale_multiplier?": "unknown",
    "rating?": "number",
    "session_notes?": "string",
  }),
);

function validateItemState(id: string, raw: unknown): ItemState | ValidationError {
  return validateByIdOrLog(ItemState, id, raw, { dataFrom: "localstorage" });
}

/** Validate the session-level fields. Does NOT load item_states. */
function validateStored(
  id: SessionId,
  raw: unknown,
): Omit<Session, "item_states"> | ValidationError {
  const result = validateByIdOrLog(StoredSession, id, raw, { dataFrom: "localstorage" });
  if (isInvalid(result)) return result;

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
function loadItemStates(doc: Y.Doc, sessionId: string): Record<string, ItemState> {
  const map = getItemStatesYmap(doc);
  const prefix = `${sessionId}/`;
  const states: Record<string, ItemState> = {};
  map.forEach((value, key) => {
    if (typeof key === "string" && key.startsWith(prefix)) {
      const itemId = key.slice(prefix.length);
      const validated = validateItemState(itemId, value);
      if (isValid(validated)) states[itemId] = validated;
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
    if (isValid(base)) {
      results.push({ ...base, item_states: loadItemStates(doc, id) });
    }
  });
  return results.sort((a, b) => b.started_at - a.started_at);
}

export function getSession(doc: Y.Doc, id: SessionId): Session | ValidationError {
  const raw = getSessionYmap(doc).get(id);
  const base = validateStored(id, raw);
  if (isInvalid(base)) return base;

  const item_states = loadItemStates(doc, id);

  // Backward compat: old sessions that stored item_states inline in the
  // session entry. Only fall back when the new map is empty for this session.
  if (Object.keys(item_states).length === 0 && typeof raw === "object" && raw !== null) {
    const stored = raw as Record<string, unknown>;
    const inline = stored["item_states"];
    if (typeof inline === "object" && inline !== null) {
      for (const [itemId, state] of Object.entries(inline as Record<string, unknown>)) {
        const validated = validateItemState(itemId, state);
        if (isValid(validated)) item_states[itemId] = validated;
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
  assertValid(session);
  return session;
}

/**
 * Merges a partial state into one item's state (creating it as unchecked
 * when missing). Writes only the affected item's entry in the item states
 * map so concurrent updates to different items do not race.
 */
export function updateSessionItemState(
  doc: Y.Doc,
  sessionId: SessionId,
  itemId: string,
  patch: Partial<ItemState>,
): Session {
  requireSession(doc, sessionId);
  const map = getItemStatesYmap(doc);
  const key = itemStateKey(sessionId, itemId);
  const existingRaw = map.get(key);
  const result = validateItemState(itemId, existingRaw);
  const existing: ItemState = isInvalid(result) ? { checked: false } : result;
  map.set(key, { ...existing, ...patch });
  const session = getSession(doc, sessionId);
  assertValid(session);
  return session;
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
  sessionId: SessionId,
  allItemIds: readonly string[],
): Session {
  requireSession(doc, sessionId);

  doc.transact(() => {
    const itemStatesMap = getItemStatesYmap(doc);
    const prefix = `${sessionId}/`;

    for (const itemId of allItemIds) {
      const key = prefix + itemId;
      const existingRaw = itemStatesMap.get(key);
      const result = validateItemState(itemId, existingRaw);
      const state: ItemState = isInvalid(result) ? { checked: false } : result;
      if (!state.checked && state.skipped !== true) {
        itemStatesMap.set(key, { ...state, skipped: true });
      }
    }

    // Update session-level fields.
    const sessionsMap = getSessionYmap(doc);
    const raw = sessionsMap.get(sessionId);
    const base = validateStored(sessionId, raw);
    if (isInvalid(base)) throw base;
    sessionsMap.set(sessionId, {
      ...base,
      status: "completed",
      completed_at: Date.now(),
    });
  });

  const session = getSession(doc, sessionId);
  assertValid(session);
  return session;
}
