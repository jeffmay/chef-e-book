import { type } from "arktype";
import type { AnyCompanion } from "../types/companion";

export class ValidationError extends Error {
  public constructor(
    public readonly companion: AnyCompanion,
    public readonly errors: type.errors,
    public readonly options: ValidationErrorOptions = {},
    public readonly reason: string = `Invalid ${companion.name}:\n${errors.toTraversalError().message}`,
  ) {
    super(`${reason}${options.dataFrom ? ` (from ${options.dataFrom})` : ""}`);
  }
}

export type ValidationErrorOptions = {
  dataFrom?: string;
};

export function validate<C extends AnyCompanion>(
  companion: C,
  data: unknown,
  options: ValidationErrorOptions = {},
): C["type"]["infer"] | ValidationError {
  const result = companion.type(data);
  if (result instanceof type.errors) {
    return new ValidationError(companion, result, options);
  }
  return result;
}

export function validateByIdOrLog<C extends AnyCompanion>(
  companion: C,
  id: string,
  data: unknown,
  options: ValidationErrorOptions = {},
): C["type"]["infer"] | ValidationError {
  const validation = validate(companion, data, options);
  if (isInvalid(validation)) {
    if (data == null) {
      const reason = `${companion.name} by id=${id} not found.`;
      const missing = new ValidationError(companion, validation.errors, options, reason);
      console.error(reason);
      return missing;
    } else {
      console.error(`Error validating id=${id}: ${validation.reason}`);
    }
  }
  return validation;
}

export function isInvalid(result: unknown | ValidationError): result is ValidationError {
  return result instanceof ValidationError;
}

export function isValid<V>(result: V | ValidationError): result is V {
  return !isInvalid(result);
}

export function assertValid<V>(result: V | ValidationError): asserts result is V {
  if (isInvalid(result)) {
    throw result;
  }
}
