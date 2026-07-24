import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Vitest runs with the web package as its working directory.
const cssPath = resolve(process.cwd(), "src/styles/global.css");
const css = readFileSync(cssPath, "utf8");

// 16px is the threshold below which mobile browsers (notably iOS Safari)
// auto-zoom the page when a text field gains focus.
const MIN_NO_ZOOM_FONT_SIZE_PX = 16;

/**
 * Returns the body of the first block opened by `opener` (which must end with
 * its `{`), tracking brace nesting so nested rule blocks are included. Returns
 * `null` when the opener is absent or its block is never closed.
 */
function extractBlockBody(source: string, opener: RegExp): string | null {
  const openMatch = opener.exec(source);
  if (openMatch === null) return null;
  const start = openMatch.index + openMatch[0].length;
  let depth = 1;
  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i);
    }
  }
  return null;
}

/** True when the comma-separated selector group targets `element` in any order. */
function selectorGroupTargets(selectorGroup: string, element: string): boolean {
  const elementStart = new RegExp(`^${element}\\b`);
  return selectorGroup.split(",").some((selector) => elementStart.test(selector.trim()));
}

/**
 * Finds the `font-size` (in px) applied to a rule that targets input, textarea,
 * and select with `!important`, searching only *inside* the mobile `@media`
 * block. Returns `null` when no such rule exists within that block — so a rule
 * that lives outside the media query does not satisfy it.
 */
function mobileInputFontSizePx(source: string): number | null {
  const mediaBody = extractBlockBody(source, /@media\s*\(max-width:\s*600px\)\s*\{/);
  if (mediaBody === null) return null;

  const ruleRegex = /([^{}]+)\{([^{}]*)\}/g;
  for (let rule = ruleRegex.exec(mediaBody); rule !== null; rule = ruleRegex.exec(mediaBody)) {
    const selectorGroup = rule[1];
    const declarations = rule[2];
    if (selectorGroup === undefined || declarations === undefined) continue;
    if (
      !selectorGroupTargets(selectorGroup, "input") ||
      !selectorGroupTargets(selectorGroup, "textarea") ||
      !selectorGroupTargets(selectorGroup, "select")
    ) {
      continue;
    }
    const fontSize = /font-size:\s*(\d+)px\s*!important/.exec(declarations);
    if (fontSize !== null) return Number(fontSize[1]);
  }
  return null;
}

describe("global.css — mobile focus-zoom prevention", () => {
  it("forces focusable text inputs to at least 16px inside the 600px mobile media query", () => {
    const fontSizePx = mobileInputFontSizePx(css);
    expect(fontSizePx).not.toBeNull();
    if (fontSizePx === null) {
      throw new Error(
        "Expected an input/textarea/select `font-size: <>px !important` rule inside the " +
          "@media (max-width: 600px) block of global.css",
      );
    }
    expect(fontSizePx).toBeGreaterThanOrEqual(MIN_NO_ZOOM_FONT_SIZE_PX);
  });
});
