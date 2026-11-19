import { beforeEach, describe, expect, it } from "vitest";
import type * as Y from "yjs";
import * as YDoc from "yjs";
import { fixedId } from "../../types/ids.ts";
import {
  type Container,
  type Ingredient,
  ContainerId,
  IngredientId,
  KitchenwareLabelId,
} from "../../types/kitchenware.ts";
import {
  addContainer,
  findContainerNameClash,
  getContainerNameIndex,
  getContainerYmap,
  renameContainer,
} from "../containerStore.ts";
import {
  addIngredient,
  findIngredientNameClash,
  getIngredientNameIndex,
  getIngredientYmap,
  renameIngredient,
  setLabelsForIngredient,
  setParentForIngredients,
} from "../ingredientStore.ts";
import {
  addLabel,
  findLabelByName,
  findLabelNameClash,
  findOrCreateLabel,
  getLabelNameIndex,
  getLabels,
  getLabelsYmap,
  renameLabel,
} from "../labelStore.ts";

const CUP = { value: { numerator: 1, denominator: 1 }, unit: "cup" } as const;
const KINDS = new Set(["ingredient" as const]);

function ingredient(key: string, name: string): Ingredient {
  return {
    kind: "ingredient",
    id: fixedId(IngredientId, key),
    name,
    default_measurement_value: CUP,
    labels: new Set(),
  };
}

const TOMATO = ingredient("tomato", "Tomato");
const BASIL = ingredient("basil", "Basil");

let doc: Y.Doc;

beforeEach(() => {
  doc = new YDoc.Doc();
});

describe("stored name keys", () => {
  it("writes the derived key with every ingredient", () => {
    addIngredient(doc, ingredient("tomatoes", "Cherry Tomatoes"));
    expect(getIngredientYmap(doc).get(fixedId(IngredientId, "tomatoes"))).toMatchObject({
      name: "Cherry Tomatoes",
      name_key: "cherry tomato",
    });
  });

  it("rewrites the key, atomically with the name, when an ingredient is renamed", () => {
    addIngredient(doc, TOMATO);
    renameIngredient(doc, TOMATO.id, "Roma Tomatoes");
    expect(getIngredientYmap(doc).get(TOMATO.id)).toMatchObject({
      name: "Roma Tomatoes",
      name_key: "roma tomato",
    });
  });

  it("keeps the key right when other fields change", () => {
    addIngredient(doc, TOMATO);
    setLabelsForIngredient(doc, TOMATO.id, [fixedId(KitchenwareLabelId, "fat")]);
    setParentForIngredients(doc, [TOMATO.id], undefined);
    expect(getIngredientYmap(doc).get(TOMATO.id)).toMatchObject({ name_key: "tomato" });
  });

  it("keeps the id when renaming, so nothing that refers to it breaks", () => {
    addIngredient(doc, TOMATO);
    renameIngredient(doc, TOMATO.id, "Plum Tomato");
    expect(getIngredientYmap(doc).has(TOMATO.id)).toBe(true);
    expect(getIngredientYmap(doc).size).toBe(1);
  });

  it("writes keys for containers and labels too, labels without singularizing", () => {
    const bowl: Container = {
      kind: "container",
      id: fixedId(ContainerId, "bowl"),
      name: "Mixing Bowls",
      labels: new Set(),
    };
    addContainer(doc, bowl);
    const labelId = addLabel(doc, "Spices", KINDS);
    expect(getContainerYmap(doc).get(bowl.id)).toMatchObject({ name_key: "mixing bowl" });
    expect(getLabelsYmap(doc).get(labelId)).toMatchObject({ name: "Spices", name_key: "spices" });
  });
});

describe("findIngredientNameClash", () => {
  beforeEach(() => {
    addIngredient(doc, TOMATO);
    addIngredient(doc, BASIL);
  });

  it("is undefined for a free name", () => {
    expect(findIngredientNameClash(doc, "Oregano")).toBeUndefined();
  });

  it.each(["Tomato", "tomato", "TOMATOES", "  Tomatoes  ", "tomato "])(
    "finds the existing ingredient for %j",
    (name) => {
      expect(findIngredientNameClash(doc, name)).toEqual({ id: TOMATO.id, name: "Tomato" });
    },
  );

  it("lets an ingredient be renamed to another spelling of its own name", () => {
    expect(findIngredientNameClash(doc, "Tomatoes", TOMATO.id)).toBeUndefined();
  });

  it("refuses a rename to a name another ingredient holds", () => {
    expect(findIngredientNameClash(doc, "Tomatoes", BASIL.id)).toEqual({
      id: TOMATO.id,
      name: "Tomato",
    });
  });

  it("never clashes on a blank name", () => {
    expect(findIngredientNameClash(doc, "   ")).toBeUndefined();
  });

  it("treats a longer name as different", () => {
    expect(findIngredientNameClash(doc, "Tomato Paste")).toBeUndefined();
  });

  it("falls back to deriving the key for an entry written before keys were stored", () => {
    getIngredientYmap(doc).set(fixedId(IngredientId, "oldentry"), {
      name: "Old Potatoes",
      default_measurement_value: CUP,
      labels: [],
    });
    expect(findIngredientNameClash(doc, "Old Potato")?.name).toBe("Old Potatoes");
  });

  it("ignores values that are not ingredients", () => {
    getIngredientYmap(doc).set("garbage", "not an ingredient");
    expect(findIngredientNameClash(doc, "Garbage")).toBeUndefined();
  });
});

describe("getIngredientNameIndex", () => {
  it("lists duplicates that already exist, lowest id first, rather than hiding them", () => {
    const a = ingredient("a", "Tomato");
    const b = ingredient("b", "Tomatoes");
    addIngredient(doc, b);
    addIngredient(doc, a);
    expect(getIngredientNameIndex(doc).get("tomato")).toEqual([a.id, b.id]);
  });

  it("reports the lowest id as the clash, so every device resolves a duplicate the same way", () => {
    addIngredient(doc, ingredient("b", "Tomatoes"));
    addIngredient(doc, ingredient("a", "Tomato"));
    expect(findIngredientNameClash(doc, "Tomato")?.id).toBe(fixedId(IngredientId, "a"));
  });
});

describe("containers", () => {
  const BOWL: Container = {
    kind: "container",
    id: fixedId(ContainerId, "bowl"),
    name: "Bowl",
    labels: new Set(),
  };

  it("clash on singular and plural, and allow a rename to its own other spelling", () => {
    addContainer(doc, BOWL);
    expect(findContainerNameClash(doc, "bowls")?.id).toBe(BOWL.id);
    expect(findContainerNameClash(doc, "Bowls", BOWL.id)).toBeUndefined();
  });

  it("rewrites the key on rename", () => {
    addContainer(doc, BOWL);
    renameContainer(doc, BOWL.id, "Steamer Baskets");
    expect(getContainerYmap(doc).get(BOWL.id)).toMatchObject({ name_key: "steamer basket" });
    expect(getContainerNameIndex(doc).get("steamer basket")).toEqual([BOWL.id]);
  });
});

describe("labels", () => {
  it("clash ignoring case and surrounding whitespace", () => {
    const id = addLabel(doc, "Dairy", KINDS);
    expect(findLabelNameClash(doc, "  dAIRY ")).toEqual({ id, name: "Dairy" });
  });

  it("do not clash on plurals: Spices and Spice are different labels", () => {
    addLabel(doc, "Spice", KINDS);
    expect(findLabelNameClash(doc, "Spices")).toBeUndefined();
  });

  it("lets a label be renamed to another case of its own name", () => {
    const id = addLabel(doc, "dairy", KINDS);
    expect(findLabelNameClash(doc, "Dairy", id)).toBeUndefined();
  });

  it("find a label by name regardless of case", () => {
    const id = addLabel(doc, "Dairy", KINDS);
    expect(findLabelByName(doc, "dairy")?.id).toBe(id);
    expect(findLabelByName(doc, "Cream")).toBeNull();
  });

  it("are reused by findOrCreateLabel under another case, but not under another number", () => {
    const dairy = addLabel(doc, "Dairy", KINDS);
    expect(findOrCreateLabel(doc, "DAIRY", KINDS)).toBe(dairy);
    const spice = findOrCreateLabel(doc, "Spice", KINDS);
    const spices = findOrCreateLabel(doc, "Spices", KINDS);
    expect(spices).not.toBe(spice);
    expect(getLabels(doc)).toHaveLength(3);
  });

  it("record the new kind when reused for another kind of thing", () => {
    const id = addLabel(doc, "Solid", new Set(["container" as const]));
    expect(findOrCreateLabel(doc, "solid", new Set(["ingredient" as const]))).toBe(id);
    expect([...(getLabels(doc).find((l) => l.id === id)?.kinds ?? [])].sort()).toEqual([
      "container",
      "ingredient",
    ]);
  });

  it("are left alone when reused for a kind they already have", () => {
    const id = addLabel(doc, "Solid", new Set(["ingredient" as const]));
    const before = JSON.stringify(getLabelsYmap(doc).toJSON());
    findOrCreateLabel(doc, "SOLID", new Set(["ingredient" as const]));
    expect(JSON.stringify(getLabelsYmap(doc).toJSON())).toBe(before);
    expect(getLabels(doc).find((l) => l.id === id)?.name).toBe("Solid");
  });

  it("rewrite the key on rename and expose it in the index", () => {
    const id = addLabel(doc, "Dairy", KINDS);
    renameLabel(doc, id, "Dairy Products");
    expect(getLabelsYmap(doc).get(id)).toMatchObject({ name_key: "dairy products" });
    expect(getLabelNameIndex(doc).get("dairy products")).toEqual([id]);
  });
});
