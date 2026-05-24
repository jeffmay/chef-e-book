import { Router, type Request, type Response } from "express";
import { nanoid } from "nanoid";
import * as Y from "yjs";
import { type } from "arktype";
import { snakeCaseName } from "@recipe-book/shared";
import type { DocumentStore } from "../storage/types.js";

const CreateBookBody = type({
  "user_id?": "string",
  name: snakeCaseName,
});

type CreateBookBody = typeof CreateBookBody.infer;

export function createBookRouter(store: DocumentStore): Router {
  const router = Router();

  // PUT /book — body: { user_id?: string, name: string }
  router.put("/", async (req: Request, res: Response) => {
    const result = CreateBookBody(req.body);
    if (result instanceof type.errors) {
      res.status(400).json({ error: result.summary });
      return;
    }

    const body = result as CreateBookBody;
    const bookId = nanoid(12);

    // Create an empty Yjs doc and persist it
    const doc = new Y.Doc();
    const state = Y.encodeStateAsUpdate(doc);
    await store.save(bookId, state);

    res.status(201).json({ book_id: bookId, name: body.name });
  });

  return router;
}
