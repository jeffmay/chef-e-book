export interface DocumentStore {
  /** Load raw Yjs document bytes by book ID. Returns null if not found. */
  load(bookId: string): Promise<Uint8Array | null>;
  /** Save raw Yjs document bytes by book ID. */
  save(bookId: string, data: Uint8Array): Promise<void>;
  /** Delete a document. */
  delete(bookId: string): Promise<void>;
}
