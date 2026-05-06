import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import * as Y from "yjs";
import { sync_router } from "../sync.js";

const app = express();
app.use(express.json());
app.use("/sync", sync_router);

describe("POST /sync/:user_id", () => {
  it("returns a base64-encoded Yjs state update for a new user", async () => {
    const res = await request(app).post("/sync/user-test-1").send({});
    expect(res.status).toBe(200);
    expect(typeof res.body.update).toBe("string");
    const decoded = Buffer.from(res.body.update as string, "base64");
    expect(decoded.length).toBeGreaterThan(0);
  });

  it("applies an incoming update and reflects it in subsequent responses", async () => {
    const doc = new Y.Doc();
    const text = doc.getText("test");
    text.insert(0, "hello");
    const update = Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64");

    const res = await request(app).post("/sync/user-test-2").send({ update });
    expect(res.status).toBe(200);

    const server_state = Buffer.from(res.body.update as string, "base64");
    const server_doc = new Y.Doc();
    Y.applyUpdate(server_doc, server_state);
    expect(server_doc.getText("test").toString()).toBe("hello");
  });

  it("returns 400 when user_id is empty", async () => {
    const res = await request(app).post("/sync/").send({});
    expect(res.status).toBe(404);
  });
});
