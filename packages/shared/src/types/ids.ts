import { type } from "arktype";
import { nanoid } from "nanoid";
import type { Length, PadStart, Truncate } from "string-ts";
import { padStart, truncate } from "string-ts";
import type { LessThan } from "type-fest";
import { type Companion } from "./companion.ts";

/**
 * The expected shape of a companion object for generating and validating identifiers.
 *
 * Satisfying this type signature allows you to use the functions in this module.
 */
export interface IdCompanion<
  N extends string,
  Opts extends { length: number } = { length: number },
> extends Companion<N, type.brand<string, N>> {
  readonly length: Opts["length"] & number;
}

/**
 * Constructs an IdCompanion object with the given parameters. The idType function is generated based on the provided idName and length.
 *
 * @param idName the name of the identifier type.
 * @param length the exact length of the ID string.
 * @param extend extend the default companion object with additional properties or methods.
 * @returns an IdCompanion object with the specified idName and length, and an idType function that generates a branded type for the ID.
 */
export function IdCompanion<const N extends string, const L extends number>(
  name: N,
  length: L,
): IdCompanion<N, { length: L }> {
  const init: IdCompanion<N, { length: L }> = {
    type: type.string.exactlyLength(length).brand(name),
    name,
    length,
  };
  return init;
}

/**
 * Produces a fixed-length string: pads with `Pad` on the left when shorter than `Len`,
 * or truncates (no omission) when longer or equal.
 */
export type FixedLen<Start extends string, Len extends number, Pad extends string> =
  LessThan<Length<Start>, Len> extends true ? PadStart<Start, Len, Pad> : Truncate<Start, Len, "">;

/**
 * A branded, fixed-length identifier type.
 * Strings shorter than `Len` are left-padded with `"-"`;
 * strings longer than `Len` are truncated with no omission marker.
 */
export type FixedId<Name extends string, Start extends string, Len extends number> = type.brand<
  FixedLen<Start, Len, "-">,
  Name
>;

/**
 * A simple no-op function that brands a string with a given IdCompanion's branding type.
 *
 * This is useful for avoid the `as` keyword and potentially getting the input string type wrong or losing the literal type information.
 */
export function branded<const N extends string, const S extends string>(
  _companion: IdCompanion<N>,
  str: S,
): type.brand<S, N> {
  return str as type.brand<S, N>;
}

/**
 * Generates a fixed-length branded identifier from a human-readable string.
 * Strings shorter than the ID length are left-padded with "-" so named IDs sort before
 * random nanoid IDs. Strings longer than the ID length are truncated with no omission marker.
 *
 * @param companion the IdCompanion object containing the length and type information
 * @param id the string to fix to the companion's length
 * @returns the fixed-length branded identifier
 *
 * @note use this for deterministic IDs (typically for fixtures/testing); use randomId for new production IDs.
 */
export function fixedId<const S extends string, const N extends string, const L extends number>(
  companion: IdCompanion<N, { length: L }>,
  id: S,
): FixedId<N, S, L> {
  const fixed =
    id.length < companion.length
      ? padStart(id, companion.length, "-")
      : truncate(id, companion.length, "");
  return branded(companion, fixed);
}

/**
 * Generates a random identifier based on the provided companion object.
 *
 * @param companion the IdCompanion object containing the length and type information for the identifier
 * @returns a random identifier of the type specified by the companion's type function.
 */
export function randomId<N extends string, L extends number>(
  companion: IdCompanion<N, { length: L }>,
): type.brand<string, N> {
  return branded(companion, nanoid(companion.length));
}

/**
 * Load an identifier from a string.
 *
 * This function should be used when loading an identifier that is already in existence,
 * rather than one entered by the user. New IDs should be validated or generated properly.
 *
 * @note this function simply avoids casting a string directly, with a small amount of
 *       type-safety by ensuring that the expected type is a string.
 */
export function loadId<N extends string>(
  _companion: IdCompanion<N>,
  id: string,
): type.brand<string, N> {
  // TODO: Add this back after converting the default ids to match the expected format
  // const result = tpe(id);
  // if (result instanceof type.errors) {
  //   console.warn(`Invalid ${companion.idName}: ${id}`, result.summary);
  // }
  return branded(_companion, id);
}
