import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_KITCHENWARE_URL, loadDefaultKitchenware } from "../defaultKitchenware.ts";

const CSV = `Unique ID,Type,Description,Default Measurement Type,Labels
------butter,ingredient,Butter,volume,fat+solid
`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadDefaultKitchenware", () => {
  it("fetches the shipped CSV and parses it", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(CSV) });
    vi.stubGlobal("fetch", fetchMock);

    const templates = await loadDefaultKitchenware();

    expect(fetchMock).toHaveBeenCalledWith(DEFAULT_KITCHENWARE_URL);
    expect(templates.map((t) => t.name)).toEqual(["Butter"]);
  });

  it("rejects when the server does not return the file", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve("") }),
    );
    await expect(loadDefaultKitchenware()).rejects.toThrow("404");
  });
});
