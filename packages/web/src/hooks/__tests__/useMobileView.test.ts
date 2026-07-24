import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MOBILE_VIEW_MAX_WIDTH, useMobileView } from "../useMobileView.ts";

type MediaListener = (event: MediaQueryListEvent) => void;

/** Install a controllable `matchMedia` stub; returns a setter that fires change events. */
function stubMatchMedia(initialMatches: boolean): { setMatches: (next: boolean) => void } {
  const listeners = new Set<MediaListener>();
  let matches = initialMatches;
  const mediaQueryList = {
    get matches() {
      return matches;
    },
    media: `(max-width: ${MOBILE_VIEW_MAX_WIDTH}px)`,
    addEventListener: (_type: string, listener: MediaListener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: MediaListener) => listeners.delete(listener),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mediaQueryList),
  );
  return {
    setMatches(next: boolean) {
      matches = next;
      const event = { matches: next } as MediaQueryListEvent;
      for (const listener of listeners) listener(event);
    },
  };
}

describe("useMobileView", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses a 600px breakpoint", () => {
    expect(MOBILE_VIEW_MAX_WIDTH).toBe(600);
  });

  it("returns false when matchMedia is unavailable", () => {
    // jsdom does not implement matchMedia, so it is undefined here.
    const { result } = renderHook(() => useMobileView());
    expect(result.current).toBe(false);
  });

  it("returns true when the viewport matches the mobile breakpoint", () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useMobileView());
    expect(result.current).toBe(true);
  });

  it("returns false when the viewport is wider than the breakpoint", () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useMobileView());
    expect(result.current).toBe(false);
  });

  it("updates reactively when the viewport crosses the breakpoint", () => {
    const controls = stubMatchMedia(false);
    const { result } = renderHook(() => useMobileView());
    expect(result.current).toBe(false);

    act(() => controls.setMatches(true));
    expect(result.current).toBe(true);

    act(() => controls.setMatches(false));
    expect(result.current).toBe(false);
  });

  it("stops listening after unmount", () => {
    const controls = stubMatchMedia(false);
    const { result, unmount } = renderHook(() => useMobileView());
    unmount();
    act(() => controls.setMatches(true));
    expect(result.current).toBe(false);
  });
});
