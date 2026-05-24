import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { DocumentStore } from "./types.js";

const FILE_SUFFIX = ".yjs";

export class LocalFileStore implements DocumentStore {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
    mkdir(this.dir, { recursive: true }).catch(() => {});
  }

  private pathFor(bookId: string): string {
    return join(this.dir, `${bookId}${FILE_SUFFIX}`);
  }

  async load(bookId: string): Promise<Uint8Array | null> {
    try {
      return await readFile(this.pathFor(bookId));
    } catch {
      return null;
    }
  }

  async save(bookId: string, data: Uint8Array): Promise<void> {
    await writeFile(this.pathFor(bookId), data);
  }

  async delete(bookId: string): Promise<void> {
    try {
      await unlink(this.pathFor(bookId));
    } catch {
      // ignore if file doesn't exist
    }
  }
}
