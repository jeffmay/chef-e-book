import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { LocalMemoryStore } from "../../storage/localMemory.js";
import { createBookRouter } from "../book.js";

function createTestApp() {
  const store = new LocalMemoryStore();
  const app = express();
  app.use(express.json());
  app.use("/book", createBookRouter(store));
  return { app, store };
}

describe("PUT /book", () => {
  it("creates a new recipe book with a valid name", async () => {
    const { app, store } = createTestApp();
    const res = await request(app).put("/book").send({ name: "My Recipe Book" });
    expect(res.status).toBe(201);
    expect(typeof res.body.book_id).toBe("string");
    expect(res.body.book_id).toHaveLength(12);
    expect(res.body.name).toBe("my_recipe_book");

    // Verify the document was stored
    const stored = await store.load(res.body.book_id as string);
    expect(stored).not.toBeNull();
  });

  it("normalizes the name to snake_case", async () => {
    const { app } = createTestApp();
    const res = await request(app).put("/book").send({ name: "  Cooking Recipes  " });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("cooking_recipes");
  });

  it("accepts an optional user_id", async () => {
    const { app } = createTestApp();
    const res = await request(app).put("/book").send({ user_id: "user-abc", name: "My Book" });
    expect(res.status).toBe(201);
    expect(typeof res.body.book_id).toBe("string");
    expect(res.body.name).toBe("my_book");
  });

  it("returns 400 when name is missing", async () => {
    const { app } = createTestApp();
    const res = await request(app).put("/book").send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when name is not a string", async () => {
    const { app } = createTestApp();
    const res = await request(app).put("/book").send({ name: 123 });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });
});
