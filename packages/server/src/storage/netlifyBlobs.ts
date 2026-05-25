import { getStore } from "@netlify/blobs";
import type { DocumentStore } from "./types.js";

export class NetlifyBlobStore implements DocumentStore {
  private readonly siteId: string;

  constructor(siteId: string) {
    this.siteId = siteId;
  }

  private store() {
    return getStore({
      siteID: this.siteId,
      name: "recipe-books",
    });
  }

  private keyFor(bookId: string): string {
    return `book-${bookId}`;
  }

  async load(bookId: string): Promise<Uint8Array | null> {
    const blob = await this.store().get(this.keyFor(bookId), {
      type: "arrayBuffer",
    });
    if (blob == null) return null;
    return new Uint8Array(blob as ArrayBuffer);
  }

  async save(bookId: string, data: Uint8Array): Promise<void> {
    await this.store().set(this.keyFor(bookId), new Blob([data.buffer as ArrayBuffer]));
  }

  async delete(bookId: string): Promise<void> {
    await this.store().delete(this.keyFor(bookId));
  }
}
