import { type } from "arktype";
import { snakeCase } from "string-ts";
import { IdCompanion } from "./ids.js";

export const UserId = IdCompanion("UserId", 12);
export type UserId = typeof UserId.type.infer;

export const RecipeBookId = IdCompanion("RecipeBookId", 12);
export type RecipeBookId = typeof RecipeBookId.type.infer;

/** Unbranded arktype: normalizes any string to snake_case via trim + snakeCase pipe. */
export const snakeCaseName = type("string.trim").pipe((s: string) => snakeCase(s));
export type SnakeCaseName = typeof snakeCaseName.infer;

/** Branded snake_case name for a RecipeBook. */
export const RecipeBookName = snakeCaseName.brand("RecipeBookName");
export type RecipeBookName = typeof RecipeBookName.infer;

export const CreateBookBody = type({
  "user_id?": "string",
  name: snakeCaseName,
});
export type CreateBookBody = typeof CreateBookBody.infer;
