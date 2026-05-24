import type { DocumentStore } from "./types.js";

export class LocalMemoryStore implements DocumentStore {
  private readonly docs = new Map<string, Uint8Array>();

  async load(bookId: string): Promise<Uint8Array | null> {
    return this.docs.get(bookId) ?? null;
  }

  async save(bookId: string, data: Uint8Array): Promise<void> {
    this.docs.set(bookId, data);
  }

  async delete(bookId: string): Promise<void> {
    this.docs.delete(bookId);
  }
}
