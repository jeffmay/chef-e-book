import { afterEach, describe, expect, it, vi } from "vitest";
import { fixedId } from "../../types/ids.ts";
import { ContainerId, IngredientId } from "../../types/kitchenware.ts";
import { RecipeId } from "../../types/recipe.ts";
import { RecipeBookId } from "../../types/recipeBook.ts";
import { RecipeFolderId } from "../../types/recipeGroup.ts";
import { buildIngredientExport, buildRecipeExport, type ExportSource } from "../buildExport.ts";
import {
  RecipeBookExport,
  parseRecipeBookExport,
  serializeRecipeBookExport,
} from "../recipeBookExport.ts";
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
} from "./fixtures.ts";

const INFO = { exported_at: 1_700_000_000_000 };

const CHEESE = ingredient("cheese", "Cheese", { labels: new Set([DAIRY_ID]) });
const SHREDDED = ingredient("shredded", "Shredded Cheese", { parent_id: CHEESE.id });
const CHEDDAR = ingredient("cheddar", "Shredded Cheddar", { parent_id: SHREDDED.id });
const FLOUR = ingredient("flour", "Flour", { labels: new Set([BAKING_ID]) });
const EGG = ingredient("egg", "Egg");
const SUGAR = ingredient("sugar", "Sugar");
const UNUSED = ingredient("unused", "Saffron");
const BOWL = container("bowl", "Bowl", [BAKING_ID]);
const UNUSED_POT = container("pot", "Pot");

const DESSERTS = folder("desserts", "Desserts");
const CAKES = folder("cakes", "Cakes", { parent_folder_id: DESSERTS.id });
const UNRELATED = folder("unrelated", "Soups");

const CAKE_ID = fixedId(RecipeId, "cake");
const PIE_ID = fixedId(RecipeId, "pie");

// An older version used the cheddar; the latest does not.
const CAKE_V1 = version(
  "cake1",
  CAKE_ID,
  [section("s1", [ingredientItem("c1", CHEDDAR.id)])],
  [CHEDDAR.id],
  1000,
);
const CAKE_V2 = version(
  "cake2",
  CAKE_ID,
  [
    section("s2", [
      ingredientItem("f1", FLOUR.id),
      {
        kind: "container",
        id: itemId("box"),
        container_id: BOWL.id,
        descriptor: "dry",
        contents: [ingredientItem("e1", EGG.id)],
      },
      section("nested", [instruction("mix1", [SUGAR.id])]),
    ]),
  ],
  [FLOUR.id],
  2000,
);
const CAKE = recipe("cake", "Cake", [CAKE_V1, CAKE_V2], { parent_folder_id: CAKES.id });
const PIE = recipe(
  "pie",
  "Pie",
  [version("pie1", PIE_ID, [section("p", [ingredientItem("pf", FLOUR.id)])], [FLOUR.id])],
  { parent_folder_id: DESSERTS.id },
);

function source(overrides: Partial<ExportSource> = {}): ExportSource {
  return {
    ingredients: [CHEESE, SHREDDED, CHEDDAR, FLOUR, EGG, SUGAR, UNUSED],
    containers: [BOWL, UNUSED_POT],
    labels: [label(DAIRY_ID, "dairy"), label(BAKING_ID, "baking")],
    recipe_folders: [
      { ...DESSERTS, manual_order: [CAKES.id, PIE_ID, fixedId(RecipeId, "elsewhere")] },
      CAKES,
      UNRELATED,
    ],
    recipes: [CAKE, PIE],
    ...overrides,
  };
}

const names = (items: ReadonlyArray<{ readonly name: string }>) => items.map((i) => i.name);
const titles = (items: ReadonlyArray<{ readonly title: string }>) => items.map((i) => i.title);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildRecipeExport — what a recipe brings", () => {
  const result = buildRecipeExport(source(), [CAKE.id], INFO);

  it("exports the recipe with only its latest version", () => {
    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0]?.versions.map((v) => v.id)).toEqual([CAKE_V2.id]);
  });

  it("brings the ingredients the latest version uses, wherever in it they appear", () => {
    // its list (Flour), a container's contents (Egg), and a step in a nested section (Sugar)
    expect(names(result.ingredients)).toEqual(expect.arrayContaining(["Flour", "Egg", "Sugar"]));
  });

  it("leaves out ingredients only an older version used, and ingredients nothing uses", () => {
    expect(names(result.ingredients)).not.toContain("Shredded Cheddar");
    expect(names(result.ingredients)).not.toContain("Saffron");
    expect(names(result.ingredients)).toEqual(["Egg", "Flour", "Sugar"]);
  });

  it("brings the containers it uses, and not the ones it does not", () => {
    expect(names(result.containers)).toEqual(["Bowl"]);
  });

  it("brings only the labels its ingredients and containers carry", () => {
    expect(names(result.labels)).toEqual(["baking"]);
  });

  it("brings the folder it sits in, with every ancestor, and not unrelated folders", () => {
    expect(names(result.recipe_folders)).toEqual(["Cakes", "Desserts"]);
  });

  it("keeps a folder's manual order to what is in the file", () => {
    const desserts = result.recipe_folders.find((f) => f.id === DESSERTS.id);
    expect(desserts?.manual_order).toEqual([CAKES.id]);
  });

  it("records nothing missing when everything is there", () => {
    expect(result.missing_references).toEqual([]);
  });

  it("describes where it came from", () => {
    const withBook = buildRecipeExport(source(), [CAKE.id], {
      ...INFO,
      source_book: { id: fixedId(RecipeBookId, "book-one"), name: "Family" },
    });
    expect(withBook.source_book?.name).toBe("Family");
    expect(withBook.format).toBe("chefe_book_export");
    expect(withBook.format_version).toBe(1);
    expect(withBook.exported_at).toBe(INFO.exported_at);
  });
});

describe("buildRecipeExport — ancestors", () => {
  it("brings an ingredient's ancestors so the hierarchy survives", () => {
    const cheddarCake = recipe("cc", "Cheddar Cake", [
      version(
        "cc1",
        fixedId(RecipeId, "cc"),
        [section("s", [ingredientItem("i", CHEDDAR.id)])],
        [CHEDDAR.id],
      ),
    ]);
    const result = buildRecipeExport(source({ recipes: [cheddarCake] }), [cheddarCake.id], INFO);
    expect(names(result.ingredients)).toEqual(["Cheese", "Shredded Cheddar", "Shredded Cheese"]);
    expect(result.ingredients.find((i) => i.id === CHEDDAR.id)?.parent_id).toBe(SHREDDED.id);
    // and their labels
    expect(names(result.labels)).toEqual(["dairy"]);
  });

  it("terminates on a parent cycle", () => {
    const a = ingredient("a", "A", {});
    const b = ingredient("b", "B", { parent_id: a.id });
    const cyclicA = { ...a, parent_id: b.id };
    const r = recipe("cy", "Cycle", [
      version("cy1", fixedId(RecipeId, "cy"), [section("s", [ingredientItem("i", a.id)])], [a.id]),
    ]);
    const result = buildRecipeExport(
      source({ ingredients: [cyclicA, b], recipes: [r] }),
      [r.id],
      INFO,
    );
    expect(names(result.ingredients)).toEqual(["A", "B"]);
  });
});

describe("buildRecipeExport — several recipes", () => {
  it("brings a shared ingredient once", () => {
    const result = buildRecipeExport(source(), [CAKE.id, PIE.id], INFO);
    expect(result.ingredients.filter((i) => i.id === FLOUR.id)).toHaveLength(1);
    expect(titles(result.recipes)).toEqual(["Cake", "Pie"]);
  });

  it("exports a recipe selected twice once", () => {
    expect(buildRecipeExport(source(), [PIE.id, PIE.id], INFO).recipes).toHaveLength(1);
  });

  it("is in a stable order whatever order the selection is in", () => {
    const a = buildRecipeExport(source(), [PIE.id, CAKE.id], INFO);
    const b = buildRecipeExport(source(), [CAKE.id, PIE.id], INFO);
    expect(a).toEqual(b);
  });

  it("exports a recipe with no versions, and brings nothing for it", () => {
    const empty = recipe("empty", "Empty", []);
    const result = buildRecipeExport(source({ recipes: [empty] }), [empty.id], INFO);
    expect(result.recipes[0]?.versions).toEqual([]);
    expect(result.ingredients).toEqual([]);
  });

  it("exports nothing for an empty selection", () => {
    const result = buildRecipeExport(source(), [], INFO);
    expect(result.recipes).toEqual([]);
    expect(result.ingredients).toEqual([]);
    expect(result.recipe_folders).toEqual([]);
  });
});

describe("buildRecipeExport — references it cannot satisfy", () => {
  const MISSING_ING = fixedId(IngredientId, "ghost");
  const MISSING_BOX = fixedId(ContainerId, "ghostbox");
  const MISSING_FOLDER = fixedId(RecipeFolderId, "ghostdir");

  it("records a missing ingredient, container, and folder instead of failing", () => {
    const r = recipe(
      "gh",
      "Ghosts",
      [
        version(
          "gh1",
          fixedId(RecipeId, "gh"),
          [
            section("s", [
              ingredientItem("i", MISSING_ING),
              {
                kind: "container",
                id: itemId("c"),
                container_id: MISSING_BOX,
                descriptor: "",
                contents: [],
              },
            ]),
          ],
          [MISSING_ING],
        ),
      ],
      { parent_folder_id: MISSING_FOLDER },
    );
    const result = buildRecipeExport(source({ recipes: [r] }), [r.id], INFO);

    expect(result.missing_references).toEqual(
      expect.arrayContaining([
        { kind: "ingredient", id: MISSING_ING, referenced_by: { kind: "recipe", id: r.id } },
        { kind: "container", id: MISSING_BOX, referenced_by: { kind: "recipe", id: r.id } },
        { kind: "folder", id: MISSING_FOLDER, referenced_by: { kind: "recipe", id: r.id } },
      ]),
    );
    // Each is recorded once, however often the recipe refers to it.
    expect(result.missing_references.filter((m) => m.id === MISSING_ING)).toHaveLength(1);
    // The file does not point at a folder it lacks.
    expect(result.recipes[0]).not.toHaveProperty("parent_folder_id");
  });

  it("records a selected recipe that does not exist", () => {
    const ghostRecipe = fixedId(RecipeId, "nothing");
    const result = buildRecipeExport(source(), [ghostRecipe], INFO);
    expect(result.missing_references).toEqual([
      { kind: "recipe", id: ghostRecipe, referenced_by: { kind: "selection", id: ghostRecipe } },
    ]);
  });

  it("drops a parent_id that names nothing, and records it", () => {
    const orphan = ingredient("orphan", "Orphan", { parent_id: fixedId(IngredientId, "nowhere") });
    const r = recipe("or", "Uses Orphan", [
      version(
        "or1",
        fixedId(RecipeId, "or"),
        [section("s", [ingredientItem("i", orphan.id)])],
        [orphan.id],
      ),
    ]);
    const result = buildRecipeExport(source({ ingredients: [orphan], recipes: [r] }), [r.id], INFO);
    expect(result.ingredients[0]).not.toHaveProperty("parent_id");
    expect(result.missing_references).toEqual([
      {
        kind: "ingredient",
        id: fixedId(IngredientId, "nowhere"),
        referenced_by: { kind: "ingredient", id: orphan.id },
      },
    ]);
  });

  it("drops a label that does not exist from the ingredient carrying it, and records it", () => {
    const labelled = ingredient("lab", "Labelled", { labels: new Set([DAIRY_ID, BAKING_ID]) });
    const r = recipe("lb", "Uses Labelled", [
      version(
        "lb1",
        fixedId(RecipeId, "lb"),
        [section("s", [ingredientItem("i", labelled.id)])],
        [labelled.id],
      ),
    ]);
    const result = buildRecipeExport(
      source({ ingredients: [labelled], labels: [label(DAIRY_ID, "dairy")], recipes: [r] }),
      [r.id],
      INFO,
    );
    expect([...(result.ingredients[0]?.labels ?? [])]).toEqual([DAIRY_ID]);
    expect(result.missing_references).toEqual([
      { kind: "label", id: BAKING_ID, referenced_by: { kind: "ingredient", id: labelled.id } },
    ]);
  });
});

describe("buildRecipeExport — validation", () => {
  it("leaves out, and warns about, a recipe that fails the export schema", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const broken = recipe(
      "bad",
      "Broken",
      [
        version(
          "bad1",
          fixedId(RecipeId, "bad"),
          [section("s", [ingredientItem("i", SUGAR.id)])],
          [SUGAR.id],
        ),
      ],
      { source_url: "not a url" },
    );
    const result = buildRecipeExport(source({ recipes: [broken, PIE] }), [broken.id, PIE.id], INFO);

    expect(titles(result.recipes)).toEqual(["Pie"]);
    // What only the broken recipe needed is not dragged in.
    expect(names(result.ingredients)).toEqual(["Flour"]);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("drops a label that fails its schema from what carries it, and records it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const broken = Object.assign(label(DAIRY_ID, "dairy"), { kinds: new Set(["nonsense"]) });
    const result = buildIngredientExport(
      source({
        ingredients: [CHEESE],
        labels: [broken, label(BAKING_ID, "baking")],
      }),
      [CHEESE.id],
      INFO,
    );

    expect(names(result.labels)).toEqual([]);
    expect([...(result.ingredients[0]?.labels ?? [])]).toEqual([]);
    expect(result.missing_references).toEqual([
      { kind: "label", id: DAIRY_ID, referenced_by: { kind: "ingredient", id: CHEESE.id } },
    ]);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("produces a file that validates against the export schema", () => {
    const result = buildRecipeExport(source(), [CAKE.id, PIE.id], INFO);
    expect(RecipeBookExport.type(JSON.parse(serializeRecipeBookExport(result)))).not.toHaveProperty(
      "summary",
    );
  });

  it("survives writing to text and reading back, Sets and all", () => {
    const result = buildRecipeExport(source(), [CAKE.id, PIE.id], INFO);
    const parsed = parseRecipeBookExport(serializeRecipeBookExport(result));
    expect(parsed).toEqual({ ok: true, value: result });
  });

  it("writes labels as arrays and carries no name_key", () => {
    const text = serializeRecipeBookExport(buildRecipeExport(source(), [CAKE.id], INFO));
    expect(
      JSON.parse(text).ingredients.find((i: { name: string }) => i.name === "Flour").labels,
    ).toEqual([BAKING_ID]);
    expect(text).not.toContain("name_key");
  });
});

describe("buildIngredientExport", () => {
  it("exports the selected ingredients with their ancestors and labels, and nothing else", () => {
    const result = buildIngredientExport(source(), [CHEDDAR.id, EGG.id], INFO);
    expect(names(result.ingredients)).toEqual([
      "Cheese",
      "Egg",
      "Shredded Cheddar",
      "Shredded Cheese",
    ]);
    expect(names(result.labels)).toEqual(["dairy"]);
    expect(result.recipes).toEqual([]);
    expect(result.containers).toEqual([]);
    expect(result.recipe_folders).toEqual([]);
  });

  it("does not bring the children of a selected ingredient", () => {
    expect(names(buildIngredientExport(source(), [CHEESE.id], INFO).ingredients)).toEqual([
      "Cheese",
    ]);
  });

  it("records a selected ingredient that does not exist", () => {
    const ghost = fixedId(IngredientId, "gone");
    const result = buildIngredientExport(source(), [EGG.id, ghost], INFO);
    expect(names(result.ingredients)).toEqual(["Egg"]);
    expect(result.missing_references).toEqual([
      { kind: "ingredient", id: ghost, referenced_by: { kind: "selection", id: ghost } },
    ]);
  });

  it("exports nothing for an empty selection", () => {
    const result = buildIngredientExport(source(), [], INFO);
    expect(result.ingredients).toEqual([]);
    expect(result.labels).toEqual([]);
  });

  it("round-trips through text", () => {
    const result = buildIngredientExport(source(), [CHEDDAR.id], INFO);
    expect(parseRecipeBookExport(serializeRecipeBookExport(result))).toEqual({
      ok: true,
      value: result,
    });
  });

  it("works from an empty book", () => {
    expect(buildIngredientExport(emptySource(), [], INFO).ingredients).toEqual([]);
  });
});
