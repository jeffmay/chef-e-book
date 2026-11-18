import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadTextFile } from "../downloadTextFile.ts";

type Clicked = { href: string; download: string; connected: boolean };

let clicked: Clicked[];
let blobs: Blob[];
let revoked: string[];

beforeEach(() => {
  vi.useFakeTimers();
  clicked = [];
  blobs = [];
  revoked = [];
  // jsdom has no object URLs, and does not navigate when a link is clicked.
  URL.createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob);
    return `blob:test/${blobs.length}`;
  });
  URL.revokeObjectURL = vi.fn((url: string) => {
    revoked.push(url);
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push({ href: this.href, download: this.download, connected: this.isConnected });
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("downloadTextFile", () => {
  it("clicks a link that downloads the text under the given file name", () => {
    downloadTextFile("family-recipes.json", '{"a":1}');
    expect(clicked).toEqual([
      { href: "blob:test/1", download: "family-recipes.json", connected: true },
    ]);
  });

  it("puts the text in a JSON blob by default", async () => {
    downloadTextFile("a.json", '{"a":1}');
    expect(blobs[0]?.type).toBe("application/json");
    expect(await blobs[0]?.text()).toBe('{"a":1}');
  });

  it("uses the media type it is given", () => {
    downloadTextFile("a.txt", "hello", "text/plain");
    expect(blobs[0]?.type).toBe("text/plain");
  });

  it("leaves nothing behind in the page", () => {
    downloadTextFile("a.json", "{}");
    expect(document.querySelector("a[download]")).toBeNull();
  });

  it("releases the object URL once the click has been handed to the browser", () => {
    downloadTextFile("a.json", "{}");
    expect(revoked).toEqual([]);
    vi.runAllTimers();
    expect(revoked).toEqual(["blob:test/1"]);
  });
});
