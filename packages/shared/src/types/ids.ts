import { type, type Type } from "arktype";
import { nanoid } from "nanoid";
import { type Companion } from "./companion";

/**
 * The expected shape of a companion object for generating and validating identifiers.
 * 
 * Satisfying this type signature allows you to use the functions in this module.
 */
export interface IdCompanion<N extends string, L extends number = number> extends Companion<N, Type<type.brand<string, N>>> {
  readonly length: L;
}

/**
 * Constructs an IdCompanion object with the given parameters. The idType function is generated based on the provided idName and length.
 * 
 * @param idName the name of the identifier type.
 * @param length the exact length of the ID string.
 * @param extend extend the default companion object with additional properties or methods.
 * @returns an IdCompanion object with the specified idName and length, and an idType function that generates a branded type for the ID.
 */
export function IdCompanion<N extends string, L extends number, R extends IdCompanion<N, L> = IdCompanion<N, L>>(name: N, length: L, extend?: (o: IdCompanion<N, L>) => R): R {
  const base: IdCompanion<N, L> = {
    type: type.string.exactlyLength(length).brand(name),
    name,
    length
  };
  return extend ? extend(base) : base as R;
}

/**
 * Pads the given string on the left with the specified padding string until it reaches the desired length.
 * Defaults to "-" so that padded IDs sort before random IDs in ascending order.
 *
 * @param id the string to pad
 * @param length the desired length
 * @param padding the padding string (default: "-")
 * @returns the id padded on the left to the desired length
 * @throws an error if the input string is already longer than the desired length
 */
export function pad_left<S extends string, L extends number, P extends string = "-">(id: S, length: L, padding?: P): PadLeftToMax<S, P, L> {
  if (id.length > length) {
    throw new Error(`ID is too long: ${id}`);
  }
  // TODO: Handle padding with multiple characters
  const str = (padding ?? "-").repeat(length - id.length) + id;
  return str as PadLeftToMax<S, P, L>;
}

/**
 * Pads the given string on the right with the specified padding string until it reaches the desired length.
 * 
 * @param id the string to pad
 * @param length the desired length
 * @param padding the padding string
 * @returns the id padded on the right to the desired length
 * @throws an error if the input string is already longer than the desired length
 */
export function pad_right<S extends string, L extends number, P extends string = "0">(id: S, length: L, padding?: P): PadRightToMax<S, P, L> {
  if (id.length > length) {
    throw new Error(`ID is too long: ${id}`);
  }
  // TODO: Handle padding with multiple characters
  const str = id + (padding ?? "0").repeat(length - id.length);
  return str as PadRightToMax<S, P, L>;
}

/**
 * Generates a left-padded branded identifier from a short human-readable string.
 * Uses "-" as the padding character so that named IDs sort before random nanoid IDs.
 *
 * @param companion the IdCompanion object containing the length and type information
 * @param id the short string to pad (must not exceed companion.length)
 * @returns the left-padded and branded identifier
 *
 * @note use this for deterministic IDs (typically for fixtures/testing); use random_id for new production IDs.
 */
export function padded_id<S extends string, N extends string, L extends number>(companion: IdCompanion<N, L>, id: S): type.brand<PadLeftToMax<S, "-", L>, N> {
  return pad_left(id, companion.length, "-") as type.brand<PadLeftToMax<S, "-", L>, N>;
}

/**
 * Generates a random identifier based on the provided companion object.
 * 
 * @param companion the IdCompanion object containing the length and type information for the identifier
 * @returns a random identifier of the type specified by the companion's type function.
 */
export function random_id<N extends string, L extends number>(companion: IdCompanion<N, L>): type.brand<string, N> {
  return nanoid(companion.length) as type.brand<string, N>;
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
export function load_id<N extends string>(_companion: IdCompanion<N>, id: string): type.brand<string, N> {
  // TODO: Add this back after converting the default ids to match the expected format
  // const result = tpe(id);
  // if (result instanceof type.errors) {
  //   console.warn(`Invalid ${companion.idName}: ${id}`, result.summary);
  // }
  return id as type.brand<string, N>;
}

/*
 * Type-level string padding utilities.
 */

// Build a tuple of length N
type BuildTuple<N extends number, T extends unknown[] = []> =
  T["length"] extends N ? T : BuildTuple<N, [...T, 0]>;

// Add one to a tuple
type Inc<T extends unknown[]> = [...T, 0];

// Convert string to tuple (length = number of characters / code units)
type StringToTuple<S extends string, T extends unknown[] = []> =
  // eslint-disable-next-line
  S extends `${infer _First}${infer Rest}` ? StringToTuple<Rest, Inc<T>> : T;
type StrLen<S extends string> = StringToTuple<S>["length"];

// Compare two numbers A and B (both small literal numbers) -> true if A >= B
type GTE<A extends number, B extends number> =
  BuildTuple<B> extends infer TB
  ? TB extends unknown[]
  ? // if we can split a tuple of length A into [..B, ...rest], then A >= B
  // eslint-disable-next-line
  BuildTuple<A> extends [...TB, ...infer _Rest] ? true : false
  : never
  : never;

// Prepend filler once
type PrependOnce<F extends string, S extends string> = `${F}${S}`;

// Append filler once (for right padding)
type AppendOnce<S extends string, F extends string> = `${S}${F}`;

// Pad left recursively until StrLen<S> >= Max
type PadLeftToMax<
  S extends string,
  F extends string,
  Max extends number
> = GTE<StrLen<S>, Max> extends true ? S : PadLeftToMax<PrependOnce<F, S>, F, Max>;

// Pad right recursively until StrLen<S> >= Max
type PadRightToMax<
  S extends string,
  F extends string,
  Max extends number
> = GTE<StrLen<S>, Max> extends true ? S : PadRightToMax<AppendOnce<S, F>, F, Max>;
