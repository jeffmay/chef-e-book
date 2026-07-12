import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { fixedId } from "../../types/ids.ts";
import { RecipeId, RecipeVersionId } from "../../types/recipe.ts";
import { SessionId } from "../../types/session.ts";
import {
  completeSession,
  createSession,
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
});
