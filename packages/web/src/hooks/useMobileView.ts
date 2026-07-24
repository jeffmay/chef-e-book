import { useEffect, useState } from "react";

/**
 * Screens this wide or narrower are treated as "mobile view". Kept in sync with
 * the `max-width: 600px` media queries in the page stylesheets.
 */
export const MOBILE_VIEW_MAX_WIDTH = 600;

const MOBILE_VIEW_QUERY = `(max-width: ${MOBILE_VIEW_MAX_WIDTH}px)`;

/** Read the current match, guarding environments without `matchMedia` (e.g. jsdom). */
function matchesMobileView(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(MOBILE_VIEW_QUERY).matches;
}

/**
 * Returns whether the viewport is in "mobile view" (≤ {@link MOBILE_VIEW_MAX_WIDTH}px),
 * updating reactively as the viewport crosses the breakpoint. Used to switch
 * layouts to a compact form (e.g. collapsing columns and folding split-button
 * default actions into their menus).
 */
export function useMobileView(): boolean {
  const [isMobileView, setIsMobileView] = useState<boolean>(matchesMobileView);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mediaQuery = window.matchMedia(MOBILE_VIEW_QUERY);
    function handleChange(event: MediaQueryListEvent): void {
      setIsMobileView(event.matches);
    }
    // Sync in case the viewport changed between the initial render and mount.
    setIsMobileView(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isMobileView;
}
