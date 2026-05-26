import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DocumentStore } from "./types.js";

const FILE_SUFFIX = ".yjs";

export class LocalFileStore implements DocumentStore {
  private readonly dir: string;
  private createDir: Promise<string | undefined | Error>;

  constructor(dir: string) {
    this.dir = dir;
    this.createDir = mkdir(this.dir, { recursive: true }).catch(
      (e) => new Error(`Could not create directory: ${dir}`, e),
    );
  }

  private pathFor(bookId: string): string {
    return join(this.dir, `${bookId}${FILE_SUFFIX}`);
  }

  async load(bookId: string): Promise<Uint8Array<ArrayBuffer> | null> {
    try {
      return await readFile(this.pathFor(bookId));
    } catch {
      return null;
    }
  }

  async save(bookId: string, data: Uint8Array): Promise<void> {
    const res = await this.createDir;
    if (res instanceof Error) {
      throw res;
    }
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
