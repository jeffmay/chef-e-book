import { Router, type Request, type Response } from "express";
import * as Y from "yjs";

export const sync_router = Router();

const user_docs = new Map<string, Y.Doc>();

function get_or_create_doc(user_id: string): Y.Doc {
  const existing = user_docs.get(user_id);
  if (existing !== undefined) return existing;
  const doc = new Y.Doc();
  user_docs.set(user_id, doc);
  return doc;
}

sync_router.post("/:user_id", (req: Request, res: Response) => {
  const raw_user_id = req.params["user_id"];
  const user_id = typeof raw_user_id === "string" ? raw_user_id : undefined;
  if (user_id === undefined || user_id === "") {
    res.status(400).json({ error: "Missing user_id" });
    return;
  }

  const body = req.body as { update?: string };
  const doc = get_or_create_doc(user_id);

  if (body.update !== undefined) {
    const update = Buffer.from(body.update, "base64");
    Y.applyUpdate(doc, update);
  }

  const state = Y.encodeStateAsUpdate(doc);
  res.json({ update: Buffer.from(state).toString("base64") });
});
