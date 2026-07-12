import { type } from "arktype";
import { IdCompanion } from "./ids.ts";
import { Fraction, Measurement } from "./measurement.ts";
import { EnumCompanion } from "./enums.ts";
import { Companion } from "./companion.ts";
import { RecipeId, RecipeVersionId } from "./recipe.ts";

export const ItemState = Companion(
  "ItemState",
  type({
    checked: "boolean",
    "skipped?": "boolean",
    "one_off_quantity?": Measurement.type,
    "notes?": "string",
  }),
);
export type ItemState = typeof ItemState.type.infer;

export const SessionStatus = EnumCompanion("SessionStatus", ["active", "completed"]);
export type SessionStatus = typeof SessionStatus.type.infer;

export const SessionId = IdCompanion("SessionId", 12);
export type SessionId = typeof SessionId.type.infer;

export const Session = Companion(
  "Session",
  type({
    id: SessionId.type,
    recipe_id: RecipeId.type,
    recipe_version_id: RecipeVersionId.type,
    started_at: "number",
    "completed_at?": "number",
    status: SessionStatus.type,
    item_states: type({ "[string]": ItemState.type }),
    "rescale_multiplier?": Fraction.type,
    "rating?": "number",
    "session_notes?": "string",
  }),
);
export type Session = typeof Session.type.infer;

export function isActiveSession(session: Session): session is Session & { status: "active" } {
  return session.status === "active";
}

export function isCompletedSession(
  session: Session,
): session is Session & { status: "completed"; completed_at: number } {
  return session.status === "completed";
}
