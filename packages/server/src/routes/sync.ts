import { Router, type Request, type Response } from "express";
import * as Y from "yjs";
import type { DocumentStore } from "../storage/types.js";

export function createSyncRouter(store: DocumentStore): Router {
  const router = Router();

  // POST /sync — body: { book_id: string, update?: string }
  router.post("/", async (req: Request, res: Response) => {
    const body = req.body as { book_id?: string; update?: string };
    const bookId = body.book_id;
    if (typeof bookId !== "string" || bookId === "") {
      res.status(400).json({ error: "Missing book_id" });
      return;
    }

    const doc = new Y.Doc();

    // Load existing document state from storage
    const existing = await store.load(bookId);
    if (existing !== null) {
      Y.applyUpdate(doc, existing);
    }

    // Apply client update if provided
    if (typeof body.update === "string") {
      const update = Buffer.from(body.update, "base64");
      Y.applyUpdate(doc, update);
    }

    // Persist after applying client update
    const newState = Y.encodeStateAsUpdate(doc);
    await store.save(bookId, newState);

    // Return full state (server always has the canonical copy)
    res.json({ update: Buffer.from(newState).toString("base64") });
  });

  return router;
}
