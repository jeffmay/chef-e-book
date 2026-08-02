import type { ContainerItem, Ingredient, Instruction } from "@recipe-book/shared";
import {
  ContainerId,
  EquipmentId,
  fixedId,
  IngredientId,
  SectionItemId,
} from "@recipe-book/shared";
import { describe, expect, it } from "vitest";
import { humanizeSeconds } from "../../duration/humanizeSeconds.ts";
import {
  containerDisplayName,
  containerSummaryDetails,
  instructionSummaryDetails,
  instructionSummaryName,
  isBlankContainer,
  isBlankInstruction,
  mergeContainerDraft,
  mergeInstructionDraft,
  summarizeContainer,
  summarizeInstruction,
} from "../drafts.ts";

const FLOUR = fixedId(IngredientId, "flour");
const BUTTER = fixedId(IngredientId, "butter");
const OVEN = fixedId(EquipmentId, "oven");
const MIXER = fixedId(EquipmentId, "mixer");
const BOWL = fixedId(ContainerId, "bowl");
const POT = fixedId(ContainerId, "pot");

const ALL_INGREDIENTS: Ingredient[] = [
  {
    kind: "ingredient",
    id: FLOUR,
    name: "Flour",
    default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" },
    labels: new Set(),
  },
  {
    kind: "ingredient",
    id: BUTTER,
    name: "Butter",
    default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" },
    labels: new Set(),
  },
];

function instruction(overrides: Partial<Instruction> = {}): Instruction {
  return {
    kind: "instruction",
    id: fixedId(SectionItemId, "i-1"),
    instruction: "",
    ...overrides,
  };
}

function container(overrides: Partial<ContainerItem> = {}): ContainerItem {
  return {
    kind: "container",
    id: fixedId(SectionItemId, "c-1"),
    container_id: BOWL,
    descriptor: "",
    contents: [],
    ...overrides,
  };
}

describe("isBlankInstruction", () => {
  it("is true for a freshly added instruction", () => {
    expect(isBlankInstruction(instruction())).toBe(true);
  });

  it("is true when an empty ingredient list is the only field set", () => {
    expect(isBlankInstruction(instruction({ ingredient_ids: [] }))).toBe(true);
  });

  it("is false once the action text is set", () => {
    expect(isBlankInstruction(instruction({ instruction: "Mix" }))).toBe(false);
  });

  it("is false once equipment is set", () => {
    expect(isBlankInstruction(instruction({ equipment_id: OVEN }))).toBe(false);
  });

  it("is false once a duration is set", () => {
    expect(isBlankInstruction(instruction({ duration_seconds: 60 }))).toBe(false);
  });

  it("is false once ingredients are selected", () => {
    expect(isBlankInstruction(instruction({ ingredient_ids: [FLOUR] }))).toBe(false);
  });
});

describe("isBlankContainer", () => {
  it("is true for a freshly added container", () => {
    expect(isBlankContainer(container())).toBe(true);
  });

  it("is false once a descriptor is set", () => {
    expect(isBlankContainer(container({ descriptor: "large" }))).toBe(false);
  });

  it("is false once it is marked ordered", () => {
    expect(isBlankContainer(container({ ordered: true }))).toBe(false);
  });

  it("is false once it holds an ingredient", () => {
    expect(
      isBlankContainer(
        container({
          contents: [
            { kind: "ingredient", id: fixedId(SectionItemId, "i-flour"), ingredient_id: FLOUR },
          ],
        }),
      ),
    ).toBe(false);
  });
});

describe("summarizeInstruction", () => {
  it("falls back to a placeholder name for a blank instruction", () => {
    expect(summarizeInstruction(instruction(), ALL_INGREDIENTS)).toBe("Untitled instruction");
  });

  it("renders the action alone when nothing else is set", () => {
    expect(summarizeInstruction(instruction({ instruction: "Mix" }), ALL_INGREDIENTS)).toBe("Mix");
  });

  it("renders action, ingredients, equipment, and duration in order", () => {
    const summary = summarizeInstruction(
      instruction({
        instruction: "Bake",
        ingredient_ids: [FLOUR, BUTTER],
        equipment_id: OVEN,
        duration_seconds: 1800,
      }),
      ALL_INGREDIENTS,
    );
    expect(summary).toBe(`Bake the Flour, Butter in the Oven for ${humanizeSeconds(1800)}`);
  });

  it("skips ingredients that are not in the kitchenware list", () => {
    const summary = summarizeInstruction(
      instruction({ instruction: "Mix", ingredient_ids: [fixedId(IngredientId, "unknown")] }),
      ALL_INGREDIENTS,
    );
    expect(summary).toBe("Mix");
  });
});

describe("summarizeContainer", () => {
  it("renders the container name alone when it has no descriptor", () => {
    expect(summarizeContainer(container())).toBe("Bowl");
  });

  it("renders the container name and descriptor", () => {
    expect(summarizeContainer(container({ descriptor: "dry ingredients" }))).toBe(
      "Bowl — dry ingredients",
    );
  });

  it("marks ordered containers", () => {
    expect(summarizeContainer(container({ descriptor: "layers", ordered: true }))).toBe(
      "Bowl — layers (ordered)",
    );
  });
});

describe("instructionSummaryName", () => {
  it("is the action verb", () => {
    expect(instructionSummaryName(instruction({ instruction: "Mix" }))).toBe("Mix");
  });

  it("falls back to a placeholder for a blank instruction", () => {
    expect(instructionSummaryName(instruction())).toBe("Untitled instruction");
  });
});

describe("instructionSummaryDetails", () => {
  it("is empty when only the action is set", () => {
    expect(instructionSummaryDetails(instruction({ instruction: "Mix" }), ALL_INGREDIENTS)).toBe(
      "",
    );
  });

  it("excludes the action verb from the details", () => {
    const details = instructionSummaryDetails(
      instruction({
        instruction: "Bake",
        ingredient_ids: [FLOUR],
        equipment_id: OVEN,
        duration_seconds: 1800,
      }),
      ALL_INGREDIENTS,
    );
    expect(details).toBe(`the Flour in the Oven for ${humanizeSeconds(1800)}`);
  });
});

describe("containerSummaryDetails", () => {
  it("is empty for a container with no descriptor and no flags", () => {
    expect(containerSummaryDetails(container())).toBe("");
  });

  it("excludes the container type from the details", () => {
    expect(containerSummaryDetails(container({ descriptor: "layers", ordered: true }))).toBe(
      "— layers (ordered)",
    );
  });
});

describe("containerDisplayName", () => {
  it("resolves a known container id to its display name", () => {
    expect(containerDisplayName(container({ container_id: POT }))).toBe("Pot");
  });

  it("falls back to the raw id for an unknown container", () => {
    const unknown = fixedId(ContainerId, "cauldron");
    expect(containerDisplayName(container({ container_id: unknown }))).toBe(unknown);
  });
});

describe("mergeInstructionDraft", () => {
  const snapshot = instruction({ instruction: "Mix", duration_seconds: 300 });

  it("keeps drafted changes", () => {
    const draft = { ...snapshot, instruction: "Whisk" };
    expect(mergeInstructionDraft(snapshot, draft, snapshot)).toMatchObject({
      instruction: "Whisk",
      duration_seconds: 300,
    });
  });

  it("takes untouched fields from the live item so concurrent edits survive", () => {
    const draft = { ...snapshot, instruction: "Whisk" };
    const live = { ...snapshot, duration_seconds: 900 };
    expect(mergeInstructionDraft(snapshot, draft, live)).toMatchObject({
      instruction: "Whisk",
      duration_seconds: 900,
    });
  });

  it("prefers the draft over a concurrent edit to the same field", () => {
    const draft = { ...snapshot, instruction: "Whisk" };
    const live = { ...snapshot, instruction: "Fold" };
    expect(mergeInstructionDraft(snapshot, draft, live)).toMatchObject({ instruction: "Whisk" });
  });

  it("drops a duration removed in the draft", () => {
    const { duration_seconds: _, ...draft } = snapshot;
    expect(mergeInstructionDraft(snapshot, draft, snapshot)).not.toHaveProperty("duration_seconds");
  });

  it("drops equipment removed in the draft", () => {
    const withEquipment = instruction({ instruction: "Bake", equipment_id: OVEN });
    const { equipment_id: _, ...draft } = withEquipment;
    expect(mergeInstructionDraft(withEquipment, draft, withEquipment)).not.toHaveProperty(
      "equipment_id",
    );
  });

  it("keeps equipment changed in the draft", () => {
    const withEquipment = instruction({ instruction: "Bake", equipment_id: OVEN });
    const draft = { ...withEquipment, equipment_id: MIXER };
    expect(mergeInstructionDraft(withEquipment, draft, withEquipment)).toMatchObject({
      equipment_id: MIXER,
    });
  });

  it("keeps an ingredient list changed in the draft", () => {
    const withIngredients = instruction({ instruction: "Mix", ingredient_ids: [FLOUR] });
    const draft = { ...withIngredients, ingredient_ids: [FLOUR, BUTTER] };
    expect(mergeInstructionDraft(withIngredients, draft, withIngredients)).toMatchObject({
      ingredient_ids: [FLOUR, BUTTER],
    });
  });

  it("takes an untouched ingredient list from the live item", () => {
    const withIngredients = instruction({ instruction: "Mix", ingredient_ids: [FLOUR] });
    const draft = { ...withIngredients, instruction: "Whisk" };
    const live = { ...withIngredients, ingredient_ids: [BUTTER] };
    expect(mergeInstructionDraft(withIngredients, draft, live)).toMatchObject({
      ingredient_ids: [BUTTER],
    });
  });

  it("drops an ingredient list cleared in the draft", () => {
    const withIngredients = instruction({ instruction: "Mix", ingredient_ids: [FLOUR] });
    const { ingredient_ids: _, ...draft } = withIngredients;
    expect(mergeInstructionDraft(withIngredients, draft, withIngredients)).not.toHaveProperty(
      "ingredient_ids",
    );
  });

  it("keeps the live id and notes", () => {
    const live = { ...snapshot, notes: ["watch closely"] };
    const draft = { ...snapshot, instruction: "Whisk" };
    expect(mergeInstructionDraft(snapshot, draft, live)).toMatchObject({
      id: live.id,
      kind: "instruction",
      notes: ["watch closely"],
    });
  });
});

describe("mergeContainerDraft", () => {
  const snapshot = container({ descriptor: "dry ingredients" });

  it("keeps drafted header changes", () => {
    const draft = { ...snapshot, container_id: POT, descriptor: "wet ingredients", ordered: true };
    expect(mergeContainerDraft(snapshot, draft, snapshot)).toMatchObject({
      container_id: POT,
      descriptor: "wet ingredients",
      ordered: true,
    });
  });

  it("takes untouched header fields from the live item", () => {
    const draft = { ...snapshot, descriptor: "wet ingredients" };
    const live = { ...snapshot, container_id: POT };
    expect(mergeContainerDraft(snapshot, draft, live)).toMatchObject({
      container_id: POT,
      descriptor: "wet ingredients",
    });
  });

  it("always takes contents from the live item, since nested rows commit directly", () => {
    const flourItem = {
      kind: "ingredient",
      id: fixedId(SectionItemId, "i-flour"),
      ingredient_id: FLOUR,
    } as const;
    const draft = { ...snapshot, descriptor: "wet ingredients" };
    const live = { ...snapshot, contents: [flourItem] };
    expect(mergeContainerDraft(snapshot, draft, live)).toMatchObject({
      descriptor: "wet ingredients",
      contents: [flourItem],
    });
  });

  it("drops the ordered flag when it is turned off in the draft", () => {
    const ordered = container({ descriptor: "layers", ordered: true });
    const draft = { ...ordered, ordered: false };
    expect(mergeContainerDraft(ordered, draft, ordered)).toMatchObject({ ordered: false });
  });

  it("keeps the live id and notes", () => {
    const live = { ...snapshot, notes: ["room temperature"] };
    const draft = { ...snapshot, descriptor: "wet ingredients" };
    expect(mergeContainerDraft(snapshot, draft, live)).toMatchObject({
      id: live.id,
      kind: "container",
      notes: ["room temperature"],
    });
  });
});
