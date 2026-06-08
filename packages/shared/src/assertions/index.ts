import { type } from "arktype";

export function isDefined<V>(value: V | null | undefined): value is V {
  return value != null;
}

export function assertDefined<V>(
  value: V | null | undefined,
  reasonNotDefined?: string,
): asserts value is V {
  if (value == null) {
    throw new Error(
      `assertDefined: value is not defined (${value})${reasonNotDefined ? ": " + reasonNotDefined : ""}`,
    );
  }
}

export function isTypeError(result: unknown): result is type.errors {
  return result instanceof type.errors;
}

export function assertValid<T>(
  result: T | type.errors,
  options?: { message?: string },
): asserts result is T {
  if (result instanceof type.errors) {
    throw new Error(
      `${options?.message ? `${options.message}\n` : ""}\n${Object.entries(result.byAncestorPath).join("\n")}`,
    );
  }
}

export function validOrThrow<T>(result: T | type.errors, options?: { message?: string }): T {
  assertValid(result, options);
  return result;
}
