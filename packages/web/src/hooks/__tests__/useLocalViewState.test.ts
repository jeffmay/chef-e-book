import { Companion } from "@recipe-book/shared";
import { act, renderHook } from "@testing-library/react";
import { type } from "arktype";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLocalViewState } from "../useLocalViewState.ts";

const TEST_KEY = "chefe_test_view";

const TestViewState = Companion(
  "TestViewState",
  type({
    open: "boolean",
    collapsed_ids: "string[]",
  }),
);

type TestViewState = typeof TestViewState.type.infer;

function createDefault(): TestViewState {
  return { open: true, collapsed_ids: [] };
}

beforeEach(() => {
  localStorage.clear();
});

describe("useLocalViewState", () => {
  it("starts from the default when nothing is stored", () => {
    const { result } = renderHook(() => useLocalViewState(TEST_KEY, TestViewState, createDefault));
    expect(result.current.viewState).toEqual({ open: true, collapsed_ids: [] });
  });

  it("starts from the stored state on the very first render", () => {
    localStorage.setItem(TEST_KEY, '{"open":false,"collapsed_ids":["xyz"]}');
    const { result } = renderHook(() => useLocalViewState(TEST_KEY, TestViewState, createDefault));
    expect(result.current.viewState).toEqual({ open: false, collapsed_ids: ["xyz"] });
  });

  // Storage-level failures are covered in storage/__tests__/safeLocalStorage.test.ts; this only
  // asserts that the hook falls back to its default rather than surfacing them.
  it("falls back to the default when the stored state is unusable", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem(TEST_KEY, '{"open":"yes","collapsed_ids":[]}');

    const { result } = renderHook(() => useLocalViewState(TEST_KEY, TestViewState, createDefault));

    expect(result.current.viewState).toEqual({ open: true, collapsed_ids: [] });
    warn.mockRestore();
  });

  it("writes updates through to localStorage", () => {
    const { result } = renderHook(() => useLocalViewState(TEST_KEY, TestViewState, createDefault));

    act(() => result.current.setViewState((prev) => ({ ...prev, open: false })));

    expect(result.current.viewState.open).toBe(false);
    expect(JSON.parse(localStorage.getItem(TEST_KEY) ?? "null")).toEqual({
      open: false,
      collapsed_ids: [],
    });
  });

  it("passes the latest state to consecutive updates", () => {
    const { result } = renderHook(() => useLocalViewState(TEST_KEY, TestViewState, createDefault));

    act(() => {
      result.current.setViewState((prev) => ({
        ...prev,
        collapsed_ids: [...prev.collapsed_ids, "a"],
      }));
      result.current.setViewState((prev) => ({
        ...prev,
        collapsed_ids: [...prev.collapsed_ids, "b"],
      }));
    });

    expect(result.current.viewState.collapsed_ids).toEqual(["a", "b"]);
  });

  it("still updates in memory when the write fails (e.g. quota exceeded)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useLocalViewState(TEST_KEY, TestViewState, createDefault));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    act(() => result.current.setViewState((prev) => ({ ...prev, open: false })));

    expect(result.current.viewState.open).toBe(false);
    vi.restoreAllMocks();
    warn.mockRestore();
  });

  it("restores the persisted state when the hook is remounted", () => {
    const first = renderHook(() => useLocalViewState(TEST_KEY, TestViewState, createDefault));
    act(() => first.result.current.setViewState((prev) => ({ ...prev, open: false })));
    first.unmount();

    const second = renderHook(() => useLocalViewState(TEST_KEY, TestViewState, createDefault));
    expect(second.result.current.viewState.open).toBe(false);
  });
});
