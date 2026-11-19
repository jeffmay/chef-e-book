import { type ExportSource, readExportSource, type RecipeBookId } from "@recipe-book/shared";
import { loadBookDoc } from "./bookDatabases.ts";

/**
 * Reads everything an import can draw from out of another book on this device, then closes it
 * again. The result is plain data, so the book is not held open while the person chooses.
 */
export async function loadBookSource(bookId: RecipeBookId): Promise<ExportSource> {
  const { doc, dispose } = await loadBookDoc(bookId);
  try {
    return readExportSource(doc);
  } finally {
    await dispose();
  }
}
