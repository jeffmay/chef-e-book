import { describe, expect, it } from "vitest";
import { fixedId } from "../ids.ts";
import { isActiveSession, isCompletedSession, SessionId, type Session } from "../session.ts";

describe("session type guards", () => {
  const activeSession: Session = {
    id: fixedId(SessionId, "sess-1"),
    recipe_id: "recipe-1",
    recipe_version_id: "ver-1",
    started_at: 1000,
    status: "active",
    item_states: {},
  };

  const completedSession: Session = {
    id: fixedId(SessionId, "sess-2"),
    recipe_id: "recipe-1",
    recipe_version_id: "ver-1",
    started_at: 1000,
    completed_at: 2000,
    status: "completed",
    item_states: {},
  };

  it("isActiveSession identifies active sessions", () => {
    expect(isActiveSession(activeSession)).toBe(true);
    expect(isActiveSession(completedSession)).toBe(false);
  });

  it("isCompletedSession identifies completed sessions", () => {
    expect(isCompletedSession(activeSession)).toBe(false);
    expect(isCompletedSession(completedSession)).toBe(true);
  });
});
