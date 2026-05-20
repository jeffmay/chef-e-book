import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUser, USER_STORAGE_KEY } from "../use_user.js";

beforeEach(() => {
  localStorage.clear();
});

describe("useUser", () => {
  it("returns null when no user is stored", () => {
    const { result } = renderHook(() => useUser());
    expect(result.current.userName).toBeNull();
  });

  it("reads an existing user from localStorage on mount", () => {
    localStorage.setItem(USER_STORAGE_KEY, "Alice");
    const { result } = renderHook(() => useUser());
    expect(result.current.userName).toBe("Alice");
  });

  it("setUserName updates state and localStorage", () => {
    const { result } = renderHook(() => useUser());
    act(() => result.current.setUserName("Bob"));
    expect(result.current.userName).toBe("Bob");
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBe("Bob");
  });

  it("clearUser resets state and removes from localStorage", () => {
    localStorage.setItem(USER_STORAGE_KEY, "Alice");
    const { result } = renderHook(() => useUser());
    act(() => result.current.clearUser());
    expect(result.current.userName).toBeNull();
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBeNull();
  });
});
