import { type } from "arktype";
import { Router, type Request, type Response } from "express";
import * as Y from "yjs";
import type { DocumentStore } from "../storage/types.js";

const SyncRequestBody = type({
  book_id: "string > 0",
  "update?": "string.base64",
});

export function createSyncRouter(store: DocumentStore): Router {
  const router = Router();

  // POST /sync — body: { book_id: string, update?: string }
  router.post("/", async (req: Request, res: Response) => {
    const body = SyncRequestBody(req.body);
    if (body instanceof type.errors) {
      res.status(400).json({ error: body.summary });
      return;
    }
    const bookId = body.book_id;
    const doc = new Y.Doc();

    // Load existing document state from storage
    const existing = await store.load(bookId);
    if (existing !== null) {
      Y.applyUpdate(doc, existing);
    }

    // Apply client update if provided
    if (typeof body.update === "string") {
      try {
        const update = Buffer.from(body.update, "base64");
        Y.applyUpdate(doc, update);
      } catch (e) {
        console.error(`Failed to apply client updates to book_id=${bookId}`, e);
        res.status(400).json({ error: "Invalid base64 string in 'update' field." });
        return;
      }
    }

    // Persist after applying client update
    const newState = Y.encodeStateAsUpdate(doc);
    await store.save(bookId, newState);

    // Return full state (server always has the canonical copy)
    res.json({ update: Buffer.from(newState).toString("base64") });
  });

  return router;
}
