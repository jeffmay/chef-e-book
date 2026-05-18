import { type } from "arktype";
import { nanoid } from "nanoid";
import { padStart, PadStart } from "string-ts";
import { type Companion } from "./companion";

/**
 * The expected shape of a companion object for generating and validating identifiers.
 * 
 * Satisfying this type signature allows you to use the functions in this module.
 */
export interface IdCompanion<N extends string, Opts extends { length: number } = { length: number }>
  extends Companion<N, type.brand<string, N>> {

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
export function IdCompanion<
  const N extends string,
  const L extends number,
  const R extends IdCompanion<N, { length: L }> = IdCompanion<N, { length: L }>
>(name: N, length: L, extend?: (o: IdCompanion<N, { length: L }>) => R): R {
  const base: IdCompanion<N, { length: L }> = {
    type: type.string.exactlyLength(length).brand(name),
    name,
    length,
  };
  return extend ? extend(base) : base as R;
}

/**
 * A simple no-op function that brands a string with a given IdCompanion's branding type.
 * 
 * This is useful for avoid the `as` keyword and potentially getting the input string type wrong or losing the literal type information.
 */
export function branded<const N extends string, const S extends string>(_companion: IdCompanion<N>, str: S): type.brand<S, N> {
  return str as type.brand<S, N>
}

/**
 * Generates a left-padded branded identifier from a short human-readable string.
 * Uses "-" as the padding character so that named IDs sort before random nanoid IDs.
 *
 * @param companion the IdCompanion object containing the length and type information
 * @param id the short string to pad (must not exceed companion.length)
 * @returns the left-padded and branded identifier
 *
 * @note use this for deterministic IDs (typically for fixtures/testing); use randomId for new production IDs.
 */
export function paddedId<S extends string, N extends string, L extends number>(companion: IdCompanion<N, { length: L }>, id: S): type.brand<PadStart<S, L, "-">, N> {
  return branded(companion, padStart(id, companion.length, "-"));
}

/**
 * Generates a random identifier based on the provided companion object.
 * 
 * @param companion the IdCompanion object containing the length and type information for the identifier
 * @returns a random identifier of the type specified by the companion's type function.
 */
export function randomId<N extends string, L extends number>(companion: IdCompanion<N, { length: L }>): type.brand<string, N> {
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
export function loadId<N extends string>(_companion: IdCompanion<N>, id: string): type.brand<string, N> {
  // TODO: Add this back after converting the default ids to match the expected format
  // const result = tpe(id);
  // if (result instanceof type.errors) {
  //   console.warn(`Invalid ${companion.idName}: ${id}`, result.summary);
  // }
  return branded(_companion, id);
}
