import { describe, expect, it } from "vitest";
import {
  BAKING_ID,
  DAIRY_ID,
  container,
  emptySource,
  folder,
  ingredient,
  ingredientItem,
  instruction,
  itemId,
  label,
  recipe,
  section,
  version,
} from "../../export/__tests__/fixtures.ts";
import type { ExportSource } from "../../export/buildExport.ts";
import { fixedId } from "../../types/ids.ts";
import { EquipmentId, IngredientId, KitchenwareLabelId } from "../../types/kitchenware.ts";
import { RecipeId } from "../../types/recipe.ts";
import { RecipeFolderId } from "../../types/recipeGroup.ts";
import { type ImportRow, isEmptyImportPlan, planImport } from "../importPlan.ts";
import { makeBundle, makeOptions, NOW } from "./importFixtures.ts";

const names = (items: ReadonlyArray<{ readonly name: string }>) => items.map((i) => i.name);
const rowsOf = (rows: ImportRow[], entity: ImportRow["entity"]) =>
  rows.filter((r) => r.entity === entity);
const actionsOf = (rows: ImportRow[], entity: ImportRow["entity"]) =>
  rowsOf(rows, entity).map((r) => `${r.name}:${r.action}`);

function target(parts: Partial<ExportSource> = {}): ExportSource {
  return { ...emptySource(), ...parts };
}

describe("planImport — labels", () => {
  it("creates a new label under the file's id", () => {
    const plan = planImport(
      target(),
      makeBundle({ labels: [label(DAIRY_ID, "dairy")] }),
      makeOptions(),
    );
    expect(plan.labels_to_create).toEqual([label(DAIRY_ID, "dairy")]);
    expect(actionsOf(plan.rows, "label")).toEqual(["dairy:create"]);
  });

  it("reuses a label the book has, ignoring case and surrounding space", () => {
    const local = label(fixedId(KitchenwareLabelId, "local"), "dairy");
    const plan = planImport(
      target({ labels: [local] }),
      makeBundle({ labels: [label(DAIRY_ID, "  DAIRY ")] }),
      makeOptions(),
    );
    expect(plan.labels_to_create).toEqual([]);
    expect(actionsOf(plan.rows, "label")).toEqual(["  DAIRY :reuse"]);
  });

  it("does not treat Spices and Spice as the same label", () => {
    const spice = label(fixedId(KitchenwareLabelId, "spice"), "Spice");
    const plan = planImport(
      target({ labels: [spice] }),
      makeBundle({ labels: [label(fixedId(KitchenwareLabelId, "spices"), "Spices")] }),
      makeOptions(),
    );
    expect(names(plan.labels_to_create)).toEqual(["Spices"]);
  });

  it("gives an existing label the kinds it did not have, and nothing else", () => {
    const local = label(DAIRY_ID, "dairy");
    const incoming = {
      ...label(fixedId(KitchenwareLabelId, "other"), "Dairy"),
      kinds: new Set(["container" as const]),
    };
    const plan = planImport(
      target({ labels: [local] }),
      makeBundle({ labels: [incoming] }),
      makeOptions(),
    );
    expect(plan.labels_to_create).toEqual([]);
    expect(plan.label_kind_updates).toEqual([
      { id: DAIRY_ID, kinds: new Set(["ingredient", "container"]) },
    ]);
  });

  it("writes no kind update when the book's label already has them", () => {
    const plan = planImport(
      target({ labels: [label(DAIRY_ID, "dairy")] }),
      makeBundle({ labels: [label(fixedId(KitchenwareLabelId, "x"), "dairy")] }),
      makeOptions(),
    );
    expect(plan.label_kind_updates).toEqual([]);
  });

  it("collapses two labels in the file that share a name", () => {
    const plan = planImport(
      target(),
      makeBundle({
        labels: [label(DAIRY_ID, "Dairy"), label(fixedId(KitchenwareLabelId, "dairy2"), "dairy")],
      }),
      makeOptions(),
    );
    expect(plan.labels_to_create).toHaveLength(1);
  });
});

describe("planImport — ingredients", () => {
  const TOMATO = ingredient("tomato", "Tomato");

  it("creates a new ingredient keeping the file's id", () => {
    const plan = planImport(target(), makeBundle({ ingredients: [TOMATO] }), makeOptions());
    expect(plan.ingredients_to_create).toEqual([TOMATO]);
    expect(actionsOf(plan.rows, "ingredient")).toEqual(["Tomato:create"]);
  });

  it("reuses an ingredient with the same id, leaving the book's version alone", () => {
    const local = { ...TOMATO, name: "Roma Tomato" };
    const plan = planImport(
      target({ ingredients: [local] }),
      makeBundle({ ingredients: [TOMATO] }),
      makeOptions(),
    );
    expect(plan.ingredients_to_create).toEqual([]);
    expect(actionsOf(plan.rows, "ingredient")).toEqual(["Tomato:reuse"]);
  });

  it.each([
    ["a plural", "Tomatoes"],
    ["another case", "TOMATO"],
    ["extra space", "  tomato "],
  ])("reuses an ingredient whose name matches as %s", (_how, name) => {
    const local = ingredient("localtomato", "Tomato");
    const incoming = ingredient("othertomato", name);
    const plan = planImport(
      target({ ingredients: [local] }),
      makeBundle({ ingredients: [incoming] }),
      makeOptions(),
    );
    expect(plan.ingredients_to_create).toEqual([]);
  });

  it("does not match a longer name", () => {
    const plan = planImport(
      target({ ingredients: [TOMATO] }),
      makeBundle({ ingredients: [ingredient("paste", "Tomato Paste")] }),
      makeOptions(),
    );
    expect(names(plan.ingredients_to_create)).toEqual(["Tomato Paste"]);
  });

  it("collapses two ingredients in the file that share a name onto one", () => {
    const plan = planImport(
      target(),
      makeBundle({ ingredients: [ingredient("a", "Tomato"), ingredient("b", "Tomatoes")] }),
      makeOptions(),
    );
    expect(plan.ingredients_to_create).toHaveLength(1);
    expect(actionsOf(plan.rows, "ingredient").sort()).toEqual(["Tomato:create", "Tomatoes:reuse"]);
  });

  it("remaps labels onto the labels the book already has, and drops ones the file does not carry", () => {
    const local = label(fixedId(KitchenwareLabelId, "local"), "baking");
    const unknown = fixedId(KitchenwareLabelId, "ghost");
    const flour = ingredient("flour", "Flour", { labels: new Set([BAKING_ID, unknown]) });
    const plan = planImport(
      target({ labels: [local] }),
      makeBundle({ ingredients: [flour], labels: [label(BAKING_ID, "Baking")] }),
      makeOptions(),
    );
    expect([...(plan.ingredients_to_create[0]?.labels ?? [])]).toEqual([local.id]);
  });

  describe("parents", () => {
    const CHEESE = ingredient("cheese", "Cheese");
    const SHREDDED = ingredient("shredded", "Shredded Cheese", { parent_id: CHEESE.id });
    const CHEDDAR = ingredient("cheddar", "Shredded Cheddar", { parent_id: SHREDDED.id });

    it("keeps the hierarchy, whatever order the file lists it in", () => {
      const plan = planImport(
        target(),
        makeBundle({ ingredients: [CHEDDAR, SHREDDED, CHEESE] }),
        makeOptions(),
      );
      const byName = new Map(plan.ingredients_to_create.map((i) => [i.name, i]));
      expect(byName.get("Cheese")?.parent_id).toBeUndefined();
      expect(byName.get("Shredded Cheese")?.parent_id).toBe(CHEESE.id);
      expect(byName.get("Shredded Cheddar")?.parent_id).toBe(SHREDDED.id);
    });

    it("hangs a new child under the book's own parent when the parent matched", () => {
      const localCheese = ingredient("localcheese", "Cheese");
      const plan = planImport(
        target({ ingredients: [localCheese] }),
        makeBundle({ ingredients: [SHREDDED, CHEESE] }),
        makeOptions(),
      );
      expect(plan.ingredients_to_create).toHaveLength(1);
      expect(plan.ingredients_to_create[0]?.parent_id).toBe(localCheese.id);
    });

    it("keeps a parent that is not in the file but is in the book", () => {
      const plan = planImport(
        target({ ingredients: [CHEESE] }),
        makeBundle({ ingredients: [SHREDDED] }),
        makeOptions(),
      );
      expect(plan.ingredients_to_create[0]?.parent_id).toBe(CHEESE.id);
    });

    it("imports without a parent, and warns, when the parent is nowhere", () => {
      const plan = planImport(target(), makeBundle({ ingredients: [SHREDDED] }), makeOptions());
      expect(plan.ingredients_to_create[0]).not.toHaveProperty("parent_id");
      expect(plan.warnings).toEqual([
        expect.stringContaining("has a parent that is not in the file"),
      ]);
    });

    it("terminates on a loop of parents, and warns", () => {
      const a = ingredient("a", "A", { parent_id: fixedId(IngredientId, "b") });
      const b = ingredient("b", "B", { parent_id: a.id });
      const plan = planImport(target(), makeBundle({ ingredients: [a, b] }), makeOptions());
      expect(plan.ingredients_to_create).toHaveLength(2);
      expect(plan.warnings.some((w) => w.includes("loop of parents"))).toBe(true);
    });
  });
});

describe("planImport — containers", () => {
  it("creates new containers and reuses the book's by name", () => {
    const plan = planImport(
      target({ containers: [container("localbowl", "Bowl")] }),
      makeBundle({ containers: [container("bowl", "Bowls"), container("pot", "Pot")] }),
      makeOptions(),
    );
    expect(names(plan.containers_to_create)).toEqual(["Pot"]);
    expect(actionsOf(plan.rows, "container")).toEqual(["Bowls:reuse", "Pot:create"]);
  });
});

describe("planImport — folders", () => {
  const DESSERTS = folder("desserts", "Desserts");
  const CAKES = folder("cakes", "Cakes", { parent_folder_id: DESSERTS.id });
  const CAKE = recipe("cake", "Cake", [version("v1", fixedId(RecipeId, "cake"), [])], {
    parent_folder_id: CAKES.id,
  });
  const bundle = () => makeBundle({ recipe_folders: [DESSERTS, CAKES], recipes: [CAKE] });

  it("retain: recreates the file's folder tree at the top level", () => {
    const plan = planImport(target(), bundle(), makeOptions());
    expect(names(plan.folders_to_create)).toEqual(["Desserts", "Cakes"]);
    const cakes = plan.folders_to_create.find((f) => f.name === "Cakes");
    expect(cakes?.parent_folder_id).toBe(DESSERTS.id);
    expect(plan.recipes_to_create[0]?.parent_folder_id).toBe(CAKES.id);
  });

  it("retain: recreates it under the chosen folder", () => {
    const home = folder("home", "Home");
    const plan = planImport(
      target({ recipe_folders: [home] }),
      bundle(),
      makeOptions({ target_folder_id: home.id }),
    );
    const desserts = plan.folders_to_create.find((f) => f.name === "Desserts");
    expect(desserts?.parent_folder_id).toBe(home.id);
  });

  it("retain: merges into a folder of the same name instead of duplicating it", () => {
    const local = folder("localdesserts", "desserts");
    const plan = planImport(target({ recipe_folders: [local] }), bundle(), makeOptions());
    expect(names(plan.folders_to_create)).toEqual(["Cakes"]);
    expect(plan.folders_to_create[0]?.parent_folder_id).toBe(local.id);
    expect(actionsOf(plan.rows, "folder")).toEqual(["Desserts:reuse", "Cakes:create"]);
  });

  it("retain: reuses a folder the book already has under the file's id", () => {
    const renamed = { ...DESSERTS, name: "Sweets" };
    const plan = planImport(target({ recipe_folders: [renamed] }), bundle(), makeOptions());
    expect(names(plan.folders_to_create)).toEqual(["Cakes"]);
    expect(plan.folders_to_create[0]?.parent_folder_id).toBe(DESSERTS.id);
  });

  it("flatten: ignores the file's folders and puts every recipe in the chosen folder", () => {
    const home = folder("home", "Home");
    const plan = planImport(
      target({ recipe_folders: [home] }),
      bundle(),
      makeOptions({ folder_mode: "flatten", target_folder_id: home.id }),
    );
    expect(plan.folders_to_create).toEqual([]);
    expect(rowsOf(plan.rows, "folder")).toEqual([]);
    expect(plan.recipes_to_create[0]?.parent_folder_id).toBe(home.id);
  });

  it("flatten: puts recipes at the top level when no folder is chosen", () => {
    const plan = planImport(target(), bundle(), makeOptions({ folder_mode: "flatten" }));
    expect(plan.recipes_to_create[0]).not.toHaveProperty("parent_folder_id");
  });

  it("creates the named folder under the target and imports into it", () => {
    const plan = planImport(
      target(),
      bundle(),
      makeOptions({ folder_mode: "flatten", new_folder_name: "From Grandma" }),
    );
    const created = plan.folders_to_create.find((f) => f.name === "From Grandma");
    expect(created).toBeDefined();
    expect(plan.recipes_to_create[0]?.parent_folder_id).toBe(created?.id);
  });

  it("reuses the named folder when the book already has it", () => {
    const existing = folder("grandma", "from grandma");
    const plan = planImport(
      target({ recipe_folders: [existing] }),
      bundle(),
      makeOptions({ folder_mode: "flatten", new_folder_name: "From Grandma" }),
    );
    expect(plan.folders_to_create).toEqual([]);
    expect(plan.recipes_to_create[0]?.parent_folder_id).toBe(existing.id);
  });

  it("retain with a named folder nests the whole tree inside it", () => {
    const plan = planImport(target(), bundle(), makeOptions({ new_folder_name: "Imported" }));
    const imported = plan.folders_to_create.find((f) => f.name === "Imported");
    const desserts = plan.folders_to_create.find((f) => f.name === "Desserts");
    expect(desserts?.parent_folder_id).toBe(imported?.id);
  });

  it("keeps a created folder's manual order to entries that resolve, mapped to the book's ids", () => {
    const ghost = fixedId(RecipeId, "ghost");
    const ordered = { ...DESSERTS, manual_order: [CAKES.id, CAKE.id, ghost] };
    const plan = planImport(
      target(),
      makeBundle({ recipe_folders: [ordered, CAKES], recipes: [CAKE] }),
      makeOptions(),
    );
    expect(plan.folders_to_create.find((f) => f.name === "Desserts")?.manual_order).toEqual([
      CAKES.id,
      CAKE.id,
    ]);
  });

  it("puts a recipe whose folder is not in the file at the destination", () => {
    const stray = recipe("stray", "Stray", [], {
      parent_folder_id: fixedId(RecipeFolderId, "gone"),
    });
    const plan = planImport(target(), makeBundle({ recipes: [stray] }), makeOptions());
    expect(plan.recipes_to_create[0]).not.toHaveProperty("parent_folder_id");
  });
});

describe("planImport — recipes", () => {
  const PIE_ID = fixedId(RecipeId, "pie");
  const FLOUR = ingredient("flour", "Flour");
  const pieV1 = version(
    "pie1",
    PIE_ID,
    [section("s", [ingredientItem("f", FLOUR.id)])],
    [FLOUR.id],
    1000,
  );
  const PIE = recipe("pie", "Pie", [pieV1]);

  it("creates a new recipe, keeping its ids and stamping it as modified now", () => {
    const plan = planImport(
      target(),
      makeBundle({ ingredients: [FLOUR], recipes: [PIE] }),
      makeOptions(),
    );
    const created = plan.recipes_to_create[0];
    expect(created?.id).toBe(PIE_ID);
    expect(created?.versions.map((v) => v.id)).toEqual([pieV1.id]);
    expect(created?.versions[0]?.recipe_id).toBe(PIE_ID);
    expect(created?.created_at).toBe(PIE.created_at);
    expect(created?.updated_at).toBe(NOW);
    expect(actionsOf(plan.rows, "recipe")).toEqual(["Pie:create"]);
  });

  it("imports a recipe that has no versions", () => {
    const empty = recipe("empty", "Empty", []);
    const plan = planImport(target(), makeBundle({ recipes: [empty] }), makeOptions());
    expect(plan.recipes_to_create[0]?.versions).toEqual([]);
  });

  describe("a recipe the book already has", () => {
    const changed = version(
      "pie2",
      PIE_ID,
      [
        section("s", [
          ingredientItem("f", FLOUR.id),
          ingredientItem("e", ingredient("egg", "Egg").id),
        ]),
      ],
      [FLOUR.id],
      3000,
    );
    const local = recipe("pie", "Pie", [pieV1], {});
    const incoming = recipe("pie", "Pie", [changed]);
    const withEgg = (extra: Partial<ExportSource> = {}) =>
      target({ ingredients: [FLOUR], recipes: [local], ...extra });
    const bundleWithEgg = () =>
      makeBundle({ ingredients: [FLOUR, ingredient("egg", "Egg")], recipes: [incoming] });

    it("matches by id and adds the file's version, leaving the recipe itself alone", () => {
      const plan = planImport(withEgg(), bundleWithEgg(), makeOptions());
      expect(plan.recipes_to_create).toEqual([]);
      expect(plan.versions_to_add).toHaveLength(1);
      const added = plan.versions_to_add[0];
      expect(added?.recipe_id).toBe(PIE_ID);
      expect(added?.version.id).toBe(changed.id);
      expect(added?.version.recipe_id).toBe(PIE_ID);
      expect(added?.version.created_at).toBe(NOW);
      expect(added?.version.description).toBe("Imported from Family Recipes on 2026-11-18");
      expect(plan.rows.find((r) => r.entity === "recipe")).toMatchObject({
        action: "new_version",
        recipe_match: "id",
      });
    });

    it("matches by title within the destination folder when the ids differ", () => {
      const other = recipe("otherpie", "pie", [changed]);
      const plan = planImport(
        withEgg(),
        makeBundle({ ingredients: [FLOUR, ingredient("egg", "Egg")], recipes: [other] }),
        makeOptions({ folder_mode: "flatten" }),
      );
      expect(plan.versions_to_add[0]?.recipe_id).toBe(PIE_ID);
      expect(plan.rows.find((r) => r.entity === "recipe")?.recipe_match).toBe("name");
    });

    it("does not match by title outside the destination folder", () => {
      const home = folder("home", "Home");
      const other = recipe("otherpie", "Pie", [changed]);
      const plan = planImport(
        withEgg({ recipe_folders: [home] }),
        makeBundle({ ingredients: [FLOUR, ingredient("egg", "Egg")], recipes: [other] }),
        makeOptions({ folder_mode: "flatten", target_folder_id: home.id }),
      );
      expect(plan.versions_to_add).toEqual([]);
      expect(plan.recipes_to_create).toHaveLength(1);
    });

    it("adds nothing when the book already has that version", () => {
      const plan = planImport(
        withEgg(),
        makeBundle({ ingredients: [FLOUR], recipes: [PIE] }),
        makeOptions(),
      );
      expect(isEmptyImportPlan(plan)).toBe(true);
      expect(plan.rows.find((r) => r.entity === "recipe")?.action).toBe("unchanged");
    });

    it("adds nothing when a version with the same content exists under other ids", () => {
      const sameContent = version(
        "different-ids",
        PIE_ID,
        [section("other-section-id", [ingredientItem("other-item-id", FLOUR.id)])],
        [FLOUR.id],
        9000,
      );
      const plan = planImport(
        withEgg(),
        makeBundle({ ingredients: [FLOUR], recipes: [recipe("pie", "Pie", [sameContent])] }),
        makeOptions(),
      );
      expect(plan.versions_to_add).toEqual([]);
    });

    it("adds nothing when an older version of the book's recipe has the content", () => {
      const evolved = recipe("pie", "Pie", [pieV1, changed]);
      const plan = planImport(
        target({ ingredients: [FLOUR, ingredient("egg", "Egg")], recipes: [evolved] }),
        makeBundle({ ingredients: [FLOUR], recipes: [PIE] }),
        makeOptions(),
      );
      expect(plan.versions_to_add).toEqual([]);
    });

    it("keeps both: a new recipe with every id regenerated, under the same title", () => {
      const plan = planImport(withEgg(), bundleWithEgg(), makeOptions({ on_match: "keep_both" }));
      const created = plan.recipes_to_create[0];
      expect(created?.title).toBe("Pie");
      expect(created?.id).not.toBe(PIE_ID);
      expect(created?.versions[0]?.id).not.toBe(changed.id);
      expect(created?.versions[0]?.recipe_id).toBe(created?.id);
      expect(plan.versions_to_add).toEqual([]);
      expect(plan.rows.find((r) => r.entity === "recipe")?.reason).toContain("alongside");
    });

    it("skips on request", () => {
      const plan = planImport(withEgg(), bundleWithEgg(), makeOptions({ on_match: "skip" }));
      expect(plan.recipes_to_create).toEqual([]);
      expect(plan.versions_to_add).toEqual([]);
      expect(plan.rows.find((r) => r.entity === "recipe")?.action).toBe("skip");
    });

    it("lets a per-recipe choice override the default", () => {
      const plan = planImport(
        withEgg(),
        bundleWithEgg(),
        makeOptions({ on_match: "merge_version", recipe_actions: { [PIE_ID]: "skip" } }),
      );
      expect(plan.versions_to_add).toEqual([]);
    });

    it("applies a per-recipe choice only to a recipe that matched", () => {
      const fresh = recipe("fresh", "Fresh", []);
      const plan = planImport(
        target(),
        makeBundle({ recipes: [fresh] }),
        makeOptions({ on_match: "skip", recipe_actions: { [fresh.id]: "skip" } }),
      );
      expect(plan.recipes_to_create).toHaveLength(1);
    });

    it("never matches a title against the file's own other recipes", () => {
      const soupA = recipe("soupa", "Soup", []);
      const soupB = recipe("soupb", "Soup", []);
      const plan = planImport(
        target(),
        makeBundle({ recipes: [soupA, soupB] }),
        makeOptions({ folder_mode: "flatten" }),
      );
      expect(plan.recipes_to_create).toHaveLength(2);
    });

    it("gives a regenerated version id when the file's is already used by another recipe", () => {
      const other = recipe("other", "Other", [pieV1]);
      const incomingVersion = version("pie1", fixedId(RecipeId, "newone"), [], [], 5000);
      const plan = planImport(
        target({ ingredients: [FLOUR], recipes: [other] }),
        makeBundle({ recipes: [recipe("newone", "New One", [incomingVersion])] }),
        makeOptions(),
      );
      expect(plan.recipes_to_create[0]?.versions[0]?.id).not.toBe(pieV1.id);
    });
  });

  describe("references inside imported recipes", () => {
    const LOCAL_TOMATO = ingredient("localtomato", "Tomato");
    const FILE_TOMATO = ingredient("filetomato", "Tomatoes");
    const LOCAL_BOWL = container("localbowl", "Bowl");
    const FILE_BOWL = container("filebowl", "Bowls");
    const RID = fixedId(RecipeId, "ref");
    const refVersion = version(
      "ref1",
      RID,
      [
        section("s", [
          ingredientItem("i1", FILE_TOMATO.id),
          {
            kind: "container",
            id: itemId("c1"),
            container_id: FILE_BOWL.id,
            descriptor: "mixing",
            contents: [ingredientItem("i2", FILE_TOMATO.id)],
          },
          instruction("step", [FILE_TOMATO.id]),
          {
            kind: "instruction",
            id: itemId("oven"),
            instruction: "bake",
            equipment_id: fixedId(EquipmentId, "oven"),
          },
        ]),
      ],
      [FILE_TOMATO.id],
    );
    const ref = recipe("ref", "Salsa", [refVersion]);
    const plan = planImport(
      target({ ingredients: [LOCAL_TOMATO], containers: [LOCAL_BOWL] }),
      makeBundle({ ingredients: [FILE_TOMATO], containers: [FILE_BOWL], recipes: [ref] }),
      makeOptions(),
    );
    const created = plan.recipes_to_create[0]?.versions[0];

    it("points ingredients at the book's own, in rows, containers' contents, instructions, and the list", () => {
      const text = JSON.stringify(created);
      expect(text).toContain(LOCAL_TOMATO.id);
      expect(text).not.toContain(FILE_TOMATO.id);
      expect(created?.ingredients.map((r) => r.ingredient_id)).toEqual([LOCAL_TOMATO.id]);
    });

    it("points containers at the book's own", () => {
      const text = JSON.stringify(created);
      expect(text).toContain(LOCAL_BOWL.id);
      expect(text).not.toContain(FILE_BOWL.id);
    });

    it("leaves equipment ids as they are", () => {
      expect(JSON.stringify(created)).toContain(fixedId(EquipmentId, "oven"));
    });

    it("imports no ingredient or container the book already has", () => {
      expect(plan.ingredients_to_create).toEqual([]);
      expect(plan.containers_to_create).toEqual([]);
    });

    it("warns about an ingredient that is in neither the file nor the book", () => {
      const ghost = fixedId(IngredientId, "ghost");
      const r = recipe("gh", "Ghosts", [
        version(
          "gh1",
          fixedId(RecipeId, "gh"),
          [section("s", [ingredientItem("i", ghost)])],
          [ghost],
        ),
      ]);
      const result = planImport(target(), makeBundle({ recipes: [r] }), makeOptions());
      expect(result.warnings).toEqual([
        '"Ghosts" uses an ingredient that is not in the file or in this book.',
      ]);
    });

    it("does not warn about an ingredient only the book has", () => {
      const r = recipe("ok", "Ok", [
        version(
          "ok1",
          fixedId(RecipeId, "ok"),
          [section("s", [ingredientItem("i", FLOUR.id)])],
          [FLOUR.id],
        ),
      ]);
      const result = planImport(
        target({ ingredients: [FLOUR] }),
        makeBundle({ recipes: [r] }),
        makeOptions(),
      );
      expect(result.warnings).toEqual([]);
    });
  });
});

describe("planImport — importing the same file twice", () => {
  it("finds everything again, so a second plan has nothing to write", async () => {
    const { applyImportPlan } = await import("../applyImport.ts");
    const { readExportSource } = await import("../../export/exportFromDoc.ts");
    const Y = await import("yjs");
    const FLOUR = ingredient("flour", "Flour", { labels: new Set([BAKING_ID]) });
    const bundle = makeBundle({
      ingredients: [FLOUR],
      containers: [container("bowl", "Bowl")],
      labels: [label(BAKING_ID, "baking")],
      recipe_folders: [folder("desserts", "Desserts")],
      recipes: [
        recipe(
          "cake",
          "Cake",
          [
            version(
              "cake1",
              fixedId(RecipeId, "cake"),
              [section("s", [ingredientItem("f", FLOUR.id)])],
              [FLOUR.id],
            ),
          ],
          { parent_folder_id: fixedId(RecipeFolderId, "desserts") },
        ),
      ],
    });
    const doc = new Y.Doc();
    applyImportPlan(doc, planImport(readExportSource(doc), bundle, makeOptions()));

    const second = planImport(readExportSource(doc), bundle, makeOptions());

    expect(isEmptyImportPlan(second)).toBe(true);
    expect(second.rows.map((r) => r.action).every((a) => a === "reuse" || a === "unchanged")).toBe(
      true,
    );
  });
});
