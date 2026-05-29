import type { distill } from "arktype";
import { type } from "arktype";

/**
 * A {@link type.Any} reified as `AnyType<T>` — a Type with the given output type,
 * ignoring its scope. Use this when you only care about the inferred output and
 * want to avoid threading the scope (`$`) type parameter through your generics.
 */
export type AnyType<T = unknown> = type.Any<T>;

/**
 * The shape of a companion object of a type.
 *
 * This companion object holds the reified name and compiler type information for a type. It is useful to pass around for generic functions
 * that need to be able to perform type-specific logic, such as parsing, validation, and generation.
 */
export interface Companion<N extends string, T> {
  readonly name: N;
  readonly type: AnyType<T>;
}

/**
 * Constructs a simple companion object with the given name and type.
 *
 * The output type `T` is derived from the supplied arktype Type via its `["infer"]`
 * field. Inferring through the indexed access (rather than from a separate `T`
 * generic parameter) is what allows brands and other intersection types in the
 * Type's output to survive inference — the same trick {@link ScopedCompanion}
 * uses for scope members.
 *
 * @param name the name of the type, used for debugging purposes
 * @param type the Arktype type that represents the type information for this companion
 * @param extend a function that takes the base companion object and returns an extended version of it with additional properties or methods
 * @returns a companion object with the specified name and type, and any additional properties or methods provided by the extend function
 */
export function Companion<const N extends string, const Z extends AnyType>(
  name: N,
  type: Z,
): Companion<N, Z["infer"]> {
  const init: Companion<N, Z["infer"]> = {
    name,
    type,
  };
  return init;
}

export interface DefCompanion<in out N extends string, in out Def> extends Companion<
  N,
  type.instantiate<Def>
> {
  readonly def: Def;
}

export function DefCompanion<const N extends string, const Def>(
  name: N,
  def: type.validate<Def>,
): DefCompanion<N, Def> {
  const defType = type.raw(def) as AnyType<type.instantiate<Def>>;
  const init: DefCompanion<N, Def> = {
    name,
    def: def as Def,
    type: defType,
  };
  return init;
}

/**
 * Constructs a companion object by selecting a member from an arktype scope by name.
 *
 * The output type is derived from the scope's resolved type via `S[N]["infer"]`, so
 * callers don't need to provide it explicitly. The scope's own `$` parameter is
 * discarded by widening the selected type to {@link AnyType}.
 */
export function ScopedCompanion<
  const S extends { [K in N]: AnyType },
  const N extends keyof S & string,
>(scope: S, name: N): Companion<N, S[N]["infer"]> {
  const companion: Companion<N, S[N]["infer"]> = {
    name,
    type: scope[name] as AnyType<S[N]["infer"]>,
  };
  return companion;
}

/**
 * A helper function for extending a companion object with additional properties before it is assigned to a const.
 */
export function extend<C extends AnyCompanion<T>, const R extends AnyCompanion<T>, T>(
  companion: C,
  fn: (self: C) => R,
): R {
  return fn(companion);
}

/**
 * A {@link Companion} with any name and the provided type (or any companion if no type provided).
 *
 * Useful for checking if a companion object matches an expected type output without concern for the name.
 * or for use as a base Companion type when you don't want to specify the lower bounds.
 */
export type AnyCompanion<T = unknown> = Companion<string, T>;

/**
 * Validate the given value, warn on type errors, and return the value alongside a boolean of whether there was an error.
 *
 * @note This is useful in cases where you would otherwise just cast the value with the `as` keyword because you would
 *       prefer to allow the runtime to throw errors on invalid values or undefined properties.
 * @note The errors part of the tuple is useful in cases where you want to apply some kind of recovery logic when the
 *       object fails to validate.
 *
 * @param companion the companion object used to get the arktype information and type name
 * @param value the value to validate and cast
 * @returns a tuple of the expected value and any validation errors (or the sentinel value of 'valid')
 */
export function validateAndPassthrough<T>(
  companion: AnyCompanion<T>,
  value: unknown,
): [value: distill.Out<T>, errors: "valid" | type.errors] {
  const result = companion.type(value);
  if (result instanceof type.errors) {
    console.warn(`Invalid ${companion.name}: ${result.summary}. Value: `, value);
    // pass the cast through and allow runtime errors as the function describes.
    return [value as distill.Out<T>, result];
  }
  return [result, "valid"];
}
