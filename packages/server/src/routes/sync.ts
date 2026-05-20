import { Router, type Request, type Response } from "express";
import * as Y from "yjs";

export const syncRouter = Router();

const userDocs = new Map<string, Y.Doc>();

function getOrCreateDoc(userId: string): Y.Doc {
  const existing = userDocs.get(userId);
  if (existing !== undefined) return existing;
  const doc = new Y.Doc();
  userDocs.set(userId, doc);
  return doc;
}

syncRouter.post("/:user_id", (req: Request, res: Response) => {
  const rawUserId = req.params["user_id"];
  const userId = typeof rawUserId === "string" ? rawUserId : undefined;
  if (userId === undefined || userId === "") {
    res.status(400).json({ error: "Missing user_id" });
    return;
  }

  const body = req.body as { update?: string };
  const doc = getOrCreateDoc(userId);

  if (body.update !== undefined) {
    const update = Buffer.from(body.update, "base64");
    Y.applyUpdate(doc, update);
  }

  const state = Y.encodeStateAsUpdate(doc);
  res.json({ update: Buffer.from(state).toString("base64") });
});
