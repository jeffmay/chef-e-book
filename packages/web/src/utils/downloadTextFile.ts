/**
 * Saves `text` to the user's device as a file named `filename`, through the browser's own download.
 *
 * A temporary object URL and a clicked link are the portable way to do this: it needs no server and
 * works the same on the e-ink tablet's browser as anywhere else.
 */
export function downloadTextFile(
  filename: string,
  text: string,
  mimeType: string = "application/json",
): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  // The browser reads the blob after the click returns, so give it time before releasing it.
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

/** How long a download's object URL stays valid; long enough for the browser to start reading it. */
export const REVOKE_DELAY_MS = 60_000;
