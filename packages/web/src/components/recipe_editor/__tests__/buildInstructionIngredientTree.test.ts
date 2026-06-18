import type { Ingredient, Section } from "@recipe-book/shared";
import { ContainerId, IngredientId, fixedId, SectionItemId } from "@recipe-book/shared";
import { describe, expect, it } from "vitest";
import {
  buildInstructionIngredientTree,
  collectKeyToIngredientId,
  ingredientIdsToSelection,
  parseSelectionKeys,
  selectionToIngredientIds,
} from "../buildInstructionIngredientTree.ts";

const BUTTER = fixedId(IngredientId, "butter");
const FLOUR = fixedId(IngredientId, "flour");
const SUGAR = fixedId(IngredientId, "sugar");
const BOWL = fixedId(ContainerId, "bowl");

function ing(id: IngredientId, name: string): Ingredient {
  return {
    kind: "ingredient",
    id,
    name,
    default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" },
    labels: new Set(),
  };
}

const ALL_INGREDIENTS = [ing(BUTTER, "Butter"), ing(FLOUR, "Flour"), ing(SUGAR, "Sugar")];

describe("buildInstructionIngredientTree", () => {
  it("places a section-level ingredient at the root as a leaf node", () => {
    const sections: Section[] = [
      {
        kind: "section",
        id: fixedId(SectionItemId, "sec1"),
        contents: [
          { kind: "ingredient", id: fixedId(SectionItemId, "i-butter"), ingredient_id: BUTTER },
        ],
      },
    ];
    const nodes = buildInstructionIngredientTree(sections, ALL_INGREDIENTS);
    expect(nodes).toHaveLength(1);
    const node = nodes[0]!;
    expect(node.key).toBe(fixedId(SectionItemId, "i-butter"));
    expect(node.label).toBe("Butter");
    expect(node.children).toBeUndefined();
    expect(node.data).toEqual({ ingredient_id: BUTTER });
  });

  it("groups container contents under a labelled container node", () => {
    const sections: Section[] = [
      {
        kind: "section",
        id: fixedId(SectionItemId, "sec1"),
        contents: [
          {
            kind: "container",
            id: fixedId(SectionItemId, "c-bowl"),
            container_id: BOWL,
            descriptor: "wet",
            contents: [
              {
                kind: "ingredient",
                id: fixedId(SectionItemId, "ci-flour"),
                ingredient_id: FLOUR,
              },
            ],
          },
        ],
      },
    ];
    const nodes = buildInstructionIngredientTree(sections, ALL_INGREDIENTS);
    expect(nodes).toHaveLength(1);
    const node = nodes[0]!;
    expect(node.label).toBe("Bowl — wet");
    expect(node.children).toHaveLength(1);
    const child = node.children![0]!;
    expect(child.data).toEqual({ ingredient_id: FLOUR });
  });

  it("omits empty containers and flattens nested sections", () => {
    const sections: Section[] = [
      {
        kind: "section",
        id: fixedId(SectionItemId, "sec1"),
        contents: [
          {
            kind: "container",
            id: fixedId(SectionItemId, "c-empty"),
            container_id: BOWL,
            descriptor: "",
            contents: [],
          },
          {
            kind: "section",
            id: fixedId(SectionItemId, "sub"),
            contents: [
              {
                kind: "ingredient",
                id: fixedId(SectionItemId, "i-sugar"),
                ingredient_id: SUGAR,
              },
            ],
          },
        ],
      },
    ];
    const nodes = buildInstructionIngredientTree(sections, ALL_INGREDIENTS);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.data).toEqual({ ingredient_id: SUGAR });
  });

  it("falls back to the ingredient id when the ingredient is unknown", () => {
    const sections: Section[] = [
      {
        kind: "section",
        id: fixedId(SectionItemId, "sec1"),
        contents: [
          { kind: "ingredient", id: fixedId(SectionItemId, "i-butter"), ingredient_id: BUTTER },
        ],
      },
    ];
    const nodes = buildInstructionIngredientTree(sections, []);
    expect(nodes[0]!.label).toBe(BUTTER);
  });
});

describe("collectKeyToIngredientId", () => {
  it("maps every leaf node key (including nested) to its ingredient id", () => {
    const nodes = [
      { key: "leaf-butter", label: "Butter", data: { ingredient_id: BUTTER } },
      {
        key: "grp-bowl",
        label: "Bowl",
        children: [{ key: "leaf-flour", label: "Flour", data: { ingredient_id: FLOUR } }],
      },
    ];
    const map = collectKeyToIngredientId(nodes);
    expect(map.get("leaf-butter")).toBe(BUTTER);
    expect(map.get("leaf-flour")).toBe(FLOUR);
    expect(map.has("grp-bowl")).toBe(false);
  });
});

describe("ingredientIdsToSelection", () => {
  const nodes = [
    {
      key: "grp-bowl",
      label: "Bowl",
      children: [
        { key: "leaf-flour", label: "Flour", data: { ingredient_id: FLOUR } },
        { key: "leaf-sugar", label: "Sugar", data: { ingredient_id: SUGAR } },
      ],
    },
  ];

  it("fully checks a container when all its children are selected", () => {
    const selection = ingredientIdsToSelection(nodes, [FLOUR, SUGAR]);
    expect(selection["grp-bowl"]).toEqual({ checked: true, partialChecked: false });
    expect(selection["leaf-flour"]).toEqual({ checked: true, partialChecked: false });
    expect(selection["leaf-sugar"]).toEqual({ checked: true, partialChecked: false });
  });

  it("partially checks a container when only some children are selected", () => {
    const selection = ingredientIdsToSelection(nodes, [FLOUR]);
    expect(selection["grp-bowl"]).toEqual({ checked: false, partialChecked: true });
    expect(selection["leaf-flour"]).toEqual({ checked: true, partialChecked: false });
    expect(selection["leaf-sugar"]).toBeUndefined();
  });
});

describe("parseSelectionKeys", () => {
  it("reduces the selection value to a key -> checked map, ignoring non-records", () => {
    const parsed = parseSelectionKeys({
      a: { checked: true },
      b: { checked: false, partialChecked: true },
      c: "ignored",
    });
    expect(parsed).toEqual({ a: true, b: false });
  });

  it("returns an empty map for null or non-object values", () => {
    expect(parseSelectionKeys(null)).toEqual({});
    expect(parseSelectionKeys("nope")).toEqual({});
  });
});

describe("selectionToIngredientIds", () => {
  it("resolves checked leaf keys to distinct ingredient ids", () => {
    const keyToIngredientId = new Map<string, IngredientId>([
      ["leaf-flour", FLOUR],
      ["leaf-sugar", SUGAR],
    ]);
    const ids = selectionToIngredientIds(
      { "leaf-flour": { checked: true }, "leaf-sugar": { checked: false } },
      keyToIngredientId,
    );
    expect(ids).toEqual([FLOUR]);
  });

  it("deduplicates when two keys reference the same ingredient", () => {
    const keyToIngredientId = new Map([
      ["leaf-a", FLOUR],
      ["leaf-b", FLOUR],
    ]);
    const ids = selectionToIngredientIds(
      { "leaf-a": { checked: true }, "leaf-b": { checked: true } },
      keyToIngredientId,
    );
    expect(ids).toEqual([FLOUR]);
  });
});
