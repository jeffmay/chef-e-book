import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import * as Y from "yjs";
import { LocalMemoryStore } from "../../storage/localMemory.js";
import { createSyncRouter } from "../sync.js";

function createTestApp() {
  const store = new LocalMemoryStore();
  const app = express();
  app.use(express.json());
  app.use("/sync", createSyncRouter(store));
  return { app, store };
}

describe("POST /sync", () => {
  it("returns a base64-encoded Yjs state update for a new book", async () => {
    const { app } = createTestApp();
    const res = await request(app).post("/sync").send({ book_id: "test-book-1" });
    expect(res.status).toBe(200);
    expect(typeof res.body.update).toBe("string");
    const decoded = Buffer.from(res.body.update as string, "base64");
    expect(decoded.length).toBeGreaterThan(0);
  });

  it("applies an incoming update and reflects it in subsequent responses", async () => {
    const { app } = createTestApp();
    const doc = new Y.Doc();
    const text = doc.getText("test");
    text.insert(0, "hello");
    const update = Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64");

    const res = await request(app).post("/sync").send({ book_id: "test-book-2", update });
    expect(res.status).toBe(200);

    const server_state = Buffer.from(res.body.update as string, "base64");
    const server_doc = new Y.Doc();
    Y.applyUpdate(server_doc, server_state);
    expect(server_doc.getText("test").toString()).toBe("hello");
  });

  it("persists state across sync calls", async () => {
    const { app, store } = createTestApp();

    // First sync: write "hello"
    const doc1 = new Y.Doc();
    doc1.getText("test").insert(0, "hello");
    const update1 = Buffer.from(Y.encodeStateAsUpdate(doc1)).toString("base64");
    await request(app).post("/sync").send({ book_id: "persist-test", update: update1 });

    // Verify stored data is the full merged state
    const stored = await store.load("persist-test");
    expect(stored).not.toBeNull();
    const verifyDoc = new Y.Doc();
    Y.applyUpdate(verifyDoc, stored!);
    expect(verifyDoc.getText("test").toString()).toBe("hello");
  });

  it("returns 400 when book_id is missing", async () => {
    const { app } = createTestApp();
    const res = await request(app).post("/sync").send({});
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: "book_id must be a string (was missing)",
    });
  });

  it("returns 400 when book_id is empty", async () => {
    const { app } = createTestApp();
    const res = await request(app).post("/sync").send({ book_id: "" });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: "book_id must be non-empty",
    });
  });
});
