import { Companion } from "@recipe-book/shared";
import { type } from "arktype";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readLocalStorage,
  readValidatedLocalStorage,
  removeLocalStorage,
  writeLocalStorage,
} from "../safeLocalStorage.ts";

const KEY = "chefe_safe_storage_test";

const StoredThing = Companion(
  "StoredThing",
  type({
    open: "boolean",
    ids: "string[]",
  }),
);

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("readLocalStorage", () => {
  it("returns the stored string", () => {
    localStorage.setItem(KEY, "stored");
    expect(readLocalStorage(KEY)).toBe("stored");
  });

  it("returns null when the key is absent", () => {
    expect(readLocalStorage(KEY)).toBeNull();
  });

  it("returns null and warns when storage throws (e.g. SecurityError)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(readLocalStorage(KEY)).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("writeLocalStorage", () => {
  it("stores the value", () => {
    writeLocalStorage(KEY, "value");
    expect(localStorage.getItem(KEY)).toBe("value");
  });

  it("warns instead of throwing when the quota is exceeded", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    expect(() => writeLocalStorage(KEY, "value")).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("removeLocalStorage", () => {
  it("removes the key", () => {
    localStorage.setItem(KEY, "value");
    removeLocalStorage(KEY);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("warns instead of throwing when storage throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(() => removeLocalStorage(KEY)).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("readValidatedLocalStorage", () => {
  it("returns the stored value when it matches the schema", () => {
    localStorage.setItem(KEY, '{"open":false,"ids":["abc"]}');
    expect(readValidatedLocalStorage(KEY, StoredThing)).toEqual({ open: false, ids: ["abc"] });
  });

  it("returns null when nothing is stored", () => {
    expect(readValidatedLocalStorage(KEY, StoredThing)).toBeNull();
  });

  it("returns null and names the schema when the stored value fails validation", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem(KEY, '{"open":"yes","ids":[]}');

    expect(readValidatedLocalStorage(KEY, StoredThing)).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("StoredThing"));
  });

  it("reports unparsable JSON as such, not as a schema failure", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem(KEY, "{not json");

    expect(readValidatedLocalStorage(KEY, StoredThing)).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Invalid JSON"),
      expect.any(SyntaxError),
    );
  });

  it("returns null without throwing when storage itself is unavailable", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(readValidatedLocalStorage(KEY, StoredThing)).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("without a localStorage global", () => {
  it("reads null, and writes/removes without throwing", () => {
    vi.stubGlobal("localStorage", undefined);

    expect(readLocalStorage(KEY)).toBeNull();
    expect(readValidatedLocalStorage(KEY, StoredThing)).toBeNull();
    expect(() => writeLocalStorage(KEY, "value")).not.toThrow();
    expect(() => removeLocalStorage(KEY)).not.toThrow();
  });
});
