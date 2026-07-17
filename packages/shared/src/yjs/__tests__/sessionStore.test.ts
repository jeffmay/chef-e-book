import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { applyUpdate, encodeStateAsUpdate } from "yjs";
import { fixedId } from "../../types/ids.ts";
import { RecipeId, RecipeVersionId } from "../../types/recipe.ts";
import { SessionId } from "../../types/session.ts";

/** Sync `from` doc into `to` doc (simulates one direction of a sync). */
function sync(from: Y.Doc, to: Y.Doc): void {
  applyUpdate(to, encodeStateAsUpdate(from));
}
import {
  completeSession,
  createSession,
  getItemStatesYmap,
  getSession,
  getSessionYmap,
  getSessions,
  updateSessionItemState,
} from "../sessionStore.ts";

const RECIPE_ID = fixedId(RecipeId, "recipe-1");
const VERSION_ID = fixedId(RecipeVersionId, "version-1");

let doc: Y.Doc;

beforeEach(() => {
  doc = new Y.Doc();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createSession / getSession", () => {
  it("creates an active session with no item states", () => {
    const session = createSession(doc, RECIPE_ID, VERSION_ID);
    const loaded = getSession(doc, session.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.recipe_id).toBe(RECIPE_ID);
    expect(loaded?.recipe_version_id).toBe(VERSION_ID);
    expect(loaded?.status).toBe("active");
    expect(loaded?.item_states).toEqual({});
    expect(loaded?.completed_at).toBeUndefined();
  });

  it("returns null for an unknown id", () => {
    expect(getSession(doc, fixedId(SessionId, "nope"))).toBeNull();
  });
});

describe("getSessions", () => {
  it("returns sessions most recently started first", () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(2000);
    const first = createSession(doc, RECIPE_ID, VERSION_ID);
    const second = createSession(doc, RECIPE_ID, VERSION_ID);
    expect(getSessions(doc).map((s) => s.id)).toEqual([second.id, first.id]);
  });

  it("skips entries that fail validation", () => {
    createSession(doc, RECIPE_ID, VERSION_ID);
    getSessionYmap(doc).set("garbage-id", { not: "a session" });
    expect(getSessions(doc)).toHaveLength(1);
  });
});

describe("updateSessionItemState", () => {
  it("creates a default unchecked state and applies the patch", () => {
    const session = createSession(doc, RECIPE_ID, VERSION_ID);
    updateSessionItemState(doc, session.id, "item-1", { checked: true });
    expect(getSession(doc, session.id)?.item_states["item-1"]).toEqual({ checked: true });
  });

  it("merges the patch into an existing state", () => {
    const session = createSession(doc, RECIPE_ID, VERSION_ID);
    updateSessionItemState(doc, session.id, "item-1", { checked: true });
    updateSessionItemState(doc, session.id, "item-1", { notes: "used less" });
    expect(getSession(doc, session.id)?.item_states["item-1"]).toEqual({
      checked: true,
      notes: "used less",
    });
  });

  it("can mark an item skipped and unskipped", () => {
    const session = createSession(doc, RECIPE_ID, VERSION_ID);
    updateSessionItemState(doc, session.id, "item-1", { skipped: true });
    expect(getSession(doc, session.id)?.item_states["item-1"]?.skipped).toBe(true);
    updateSessionItemState(doc, session.id, "item-1", { skipped: false });
    expect(getSession(doc, session.id)?.item_states["item-1"]?.skipped).toBe(false);
  });

  it("throws for a missing session", () => {
    const session = createSession(doc, RECIPE_ID, VERSION_ID);
    getSessionYmap(doc).delete(session.id);
    expect(() => updateSessionItemState(doc, session.id, "item-1", { checked: true })).toThrow(
      /not found/,
    );
  });

  it("stores item states in a separate map keyed by session_id/item_id", () => {
    const session = createSession(doc, RECIPE_ID, VERSION_ID);
    updateSessionItemState(doc, session.id, "item-1", { checked: true });
    updateSessionItemState(doc, session.id, "item-2", { skipped: true });

    const itemStatesMap = getItemStatesYmap(doc);
    expect(itemStatesMap.get(`${session.id}/item-1`)).toEqual({ checked: true });
    expect(itemStatesMap.get(`${session.id}/item-2`)).toEqual({ checked: false, skipped: true });

    // The session entry itself should NOT contain item_states.
    const sessionEntry = getSessionYmap(doc).get(session.id) as Record<string, unknown>;
    expect(sessionEntry["item_states"]).toBeUndefined();
  });
});

describe("completeSession", () => {
  it("records completion time and status", () => {
    const session = createSession(doc, RECIPE_ID, VERSION_ID);
    const completed = completeSession(doc, session.id, []);
    expect(completed.status).toBe("completed");
    expect(completed.completed_at).toBeTypeOf("number");
    expect(getSession(doc, session.id)?.status).toBe("completed");
  });

  it("marks unchecked, unskipped items as skipped", () => {
    const session = createSession(doc, RECIPE_ID, VERSION_ID);
    updateSessionItemState(doc, session.id, "item-checked", { checked: true });
    updateSessionItemState(doc, session.id, "item-skipped", { skipped: true });
    const completed = completeSession(doc, session.id, [
      "item-checked",
      "item-skipped",
      "item-untouched",
    ]);
    expect(completed.item_states["item-checked"]).toEqual({ checked: true });
    expect(completed.item_states["item-skipped"]?.skipped).toBe(true);
    expect(completed.item_states["item-untouched"]).toEqual({ checked: false, skipped: true });
  });

  it("does not delete completed sessions on subsequent reads", () => {
    const session = createSession(doc, RECIPE_ID, VERSION_ID);
    completeSession(doc, session.id, []);
    expect(getSessions(doc)).toHaveLength(1);
  });

  it("writes item states to the separate map, not inline in the session entry", () => {
    const session = createSession(doc, RECIPE_ID, VERSION_ID);
    updateSessionItemState(doc, session.id, "item-1", { checked: true });
    completeSession(doc, session.id, ["item-1", "item-2"]);

    const sessionEntry = getSessionYmap(doc).get(session.id) as Record<string, unknown>;
    expect(sessionEntry["item_states"]).toBeUndefined();
  });
});

describe("concurrent merge", () => {
  it("merges concurrent updates to different items without data loss", () => {
    const alice = new Y.Doc();
    const bob = new Y.Doc();

    // Create the session on Alice and sync to Bob so they share the same id.
    const session = createSession(alice, RECIPE_ID, VERSION_ID);
    sync(alice, bob);
    sync(bob, alice);

    const sessionId = session.id;
    expect(getSessions(bob)![0]!.id).toBe(sessionId);

    // Alice checks item A; Bob checks item B — concurrently.
    updateSessionItemState(alice, sessionId, "item-a", { checked: true });
    updateSessionItemState(bob, sessionId, "item-b", { checked: true });

    // Sync both ways.
    sync(alice, bob);
    sync(bob, alice);

    const mergedAlice = getSession(alice, sessionId)!;
    const mergedBob = getSession(bob, sessionId)!;

    // Both items should be checked — no data loss.
    expect(mergedAlice.item_states["item-a"]).toEqual({ checked: true });
    expect(mergedAlice.item_states["item-b"]).toEqual({ checked: true });
    expect(mergedBob.item_states["item-a"]).toEqual({ checked: true });
    expect(mergedBob.item_states["item-b"]).toEqual({ checked: true });
  });

  it("completing does not overwrite concurrent item updates on different items", () => {
    const alice = new Y.Doc();
    const bob = new Y.Doc();

    const session = createSession(alice, RECIPE_ID, VERSION_ID);
    sync(alice, bob);
    sync(bob, alice);

    const sessionId = session.id;

    // Alice checks item "item-a" while Bob completes (which marks unchecked
    // items as skipped). These touch different map keys, so both survive.
    updateSessionItemState(alice, sessionId, "item-a", { checked: true });
    completeSession(bob, sessionId, ["item-a", "item-b"]);

    // Sync both ways.
    sync(alice, bob);
    sync(bob, alice);

    const mergedAlice = getSession(alice, sessionId)!;
    const mergedBob = getSession(bob, sessionId)!;

    // Both peers converge to the same state after sync.
    expect(mergedAlice.status).toBe("completed");
    expect(mergedAlice.completed_at).toBeTypeOf("number");
    expect(mergedBob.status).toBe("completed");
    expect(mergedBob.completed_at).toBeTypeOf("number");

    // item-a was updated concurrently by both peers (Alice: checked=true,
    // Bob: marked skipped because it was unchecked on his doc). For the
    // same map key, last-writer-wins applies — verify convergence.
    expect(mergedAlice.item_states["item-a"]).toEqual(mergedBob.item_states["item-a"]);

    // item-b was only written by Bob's completion — always survives.
    expect(mergedAlice.item_states["item-b"]).toEqual({ checked: false, skipped: true });
    expect(mergedBob.item_states["item-b"]).toEqual({ checked: false, skipped: true });
  });

  it("last-writer-wins for the same item key (inherent CRDT limit)", () => {
    const alice = new Y.Doc();
    const bob = new Y.Doc();

    const session = createSession(alice, RECIPE_ID, VERSION_ID);
    sync(alice, bob);
    sync(bob, alice);

    const sessionId = session.id;

    // Both peers update the same item — last-writer-wins is unavoidable.
    updateSessionItemState(alice, sessionId, "item-x", { checked: true });
    updateSessionItemState(bob, sessionId, "item-x", { skipped: true });

    // Sync both ways.
    sync(alice, bob);
    sync(bob, alice);

    const merged = getSession(alice, sessionId)!;
    const mergedBob = getSession(bob, sessionId)!;
    // Both peers converge to the same state.
    expect(merged.item_states["item-x"]).toEqual(mergedBob.item_states["item-x"]);
  });
});

describe("backward compatibility with inline item_states", () => {
  it("reads item_states from the session entry when the separate map is empty", () => {
    const session = createSession(doc, RECIPE_ID, VERSION_ID);

    // Simulate an old-format session entry: write inline item_states.
    const sessionEntry = getSessionYmap(doc).get(session.id) as Record<string, unknown>;
    getSessionYmap(doc).set(session.id, {
      ...sessionEntry,
      item_states: {
        "old-item": { checked: true },
      },
    });

    const loaded = getSession(doc, session.id)!;
    expect(loaded.item_states["old-item"]).toEqual({ checked: true });
  });

  it("prefers the separate map over inline item_states", () => {
    const session = createSession(doc, RECIPE_ID, VERSION_ID);

    // Seed both inline (old format) and separate map (new format).
    const sessionEntry = getSessionYmap(doc).get(session.id) as Record<string, unknown>;
    getSessionYmap(doc).set(session.id, {
      ...sessionEntry,
      item_states: { "old-item": { checked: true, notes: "old" } },
    });
    getItemStatesYmap(doc).set(`${session.id}/new-item`, { checked: true, notes: "new" });

    const loaded = getSession(doc, session.id)!;
    // Both should be present (separate map is not empty, so inline is skipped).
    expect(loaded.item_states["new-item"]).toEqual({ checked: true, notes: "new" });
    expect(loaded.item_states["old-item"]).toBeUndefined();
  });

  it("only falls back to inline when no entries exist in the separate map for that session", () => {
    const session = createSession(doc, RECIPE_ID, VERSION_ID);

    // Write inline item_states.
    const sessionEntry = getSessionYmap(doc).get(session.id) as Record<string, unknown>;
    getSessionYmap(doc).set(session.id, {
      ...sessionEntry,
      item_states: { "old-item": { checked: true } },
    });

    // Also write a different session's state in the separate map — should not
    // suppress the inline fallback for our session.
    const otherSession = createSession(doc, RECIPE_ID, VERSION_ID);
    updateSessionItemState(doc, otherSession.id, "other-item", { checked: true });

    const loaded = getSession(doc, session.id)!;
    expect(loaded.item_states["old-item"]).toEqual({ checked: true });
  });
});
