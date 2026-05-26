import { type } from "arktype";
import { snakeCase } from "string-ts";
import { Companion } from "./companion.js";
import { IdCompanion } from "./ids.js";

export const UserId = IdCompanion("UserId", 12);
export type UserId = typeof UserId.type.infer;

export const RecipeBookId = IdCompanion("RecipeBookId", 12);
export type RecipeBookId = typeof RecipeBookId.type.infer;

export const RecipeBookName = Companion(
  "RecipeBookName",
  type("(string.trim |> string.normalize)#RecipeBookName"),
);
export type RecipeBookName = typeof RecipeBookName.type.infer;

export const RecipeBookSlug = Companion(
  "RecipeBookSlug",
  RecipeBookName.type.pipe((s) => snakeCase(s)).brand("RecipeBookSlug"),
);
export type RecipeBookSlug = typeof RecipeBookSlug.type.infer;

export const CreateBookBody = type({
  id: "string",
  name: RecipeBookName.type,
  slug: RecipeBookSlug.type,
});
export type CreateBookBody = typeof CreateBookBody.infer;
