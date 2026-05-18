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
export function Companion<
  const N extends string,
  const Z extends AnyType,
  const R extends Companion<N, Z["infer"]> = Companion<N, Z["infer"]>,
>(name: N, type: Z, extend?: (o: Companion<N, Z["infer"]>) => R): R {
  const base: Companion<N, Z["infer"]> = { name, type };
  return extend ? extend(base) : (base as R);
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
  const R extends Companion<N, S[N]["infer"]> = Companion<N, S[N]["infer"]>,
>(scope: S, name: N, extend?: (o: Companion<N, S[N]["infer"]>) => R): R {
  const base: Companion<N, S[N]["infer"]> = {
    name,
    type: scope[name] as AnyType<S[N]["infer"]>,
  };
  return extend ? extend(base) : (base as R);
}

/**
 * A {@link Companion} with any name and the provided type (or any companion if no type provided).
 * 
 * Useful for checking if a companion object matches an expected type output without concern for the name.
 * or for use as a base Companion type when you don't want to specify the lower bounds.
 */
export type AnyCompanion<T = unknown> = Companion<string, T>;
