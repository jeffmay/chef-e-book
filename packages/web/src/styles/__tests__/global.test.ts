import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Vitest runs with the web package as its working directory.
const cssPath = resolve(process.cwd(), "src/styles/global.css");
const css = readFileSync(cssPath, "utf8");

// 16px is the threshold below which mobile browsers (notably iOS Safari)
// auto-zoom the page when a text field gains focus.
const MIN_NO_ZOOM_FONT_SIZE_PX = 16;

describe("global.css — mobile focus-zoom prevention", () => {
  it("forces focusable text inputs to at least 16px within the 600px mobile breakpoint", () => {
    expect(css).toMatch(/@media\s*\(max-width:\s*600px\)/);

    const match = css.match(
      /input[^{]*textarea[^{]*select[^{]*\{[^}]*font-size:\s*(\d+)px\s*!important/,
    );
    expect(match).not.toBeNull();
    if (match === null) {
      throw new Error("Expected a mobile input font-size rule in global.css");
    }
    expect(Number(match[1])).toBeGreaterThanOrEqual(MIN_NO_ZOOM_FONT_SIZE_PX);
  });
});
