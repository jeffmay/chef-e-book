import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readLocalStorage, removeLocalStorage, writeLocalStorage } from "../safeLocalStorage.ts";

const KEY = "chefe_safe_storage_test";

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

describe("without a localStorage global", () => {
  it("reads null, and writes/removes without throwing", () => {
    vi.stubGlobal("localStorage", undefined);

    expect(readLocalStorage(KEY)).toBeNull();
    expect(() => writeLocalStorage(KEY, "value")).not.toThrow();
    expect(() => removeLocalStorage(KEY)).not.toThrow();
  });
});
