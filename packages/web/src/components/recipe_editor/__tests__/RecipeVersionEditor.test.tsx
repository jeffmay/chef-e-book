import type { Section } from "@recipe-book/shared";
import {
  assertDefined,
  ContainerId,
  EquipmentId,
  fixedId,
  IngredientId,
  loadId,
  SectionItemId,
} from "@recipe-book/shared";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TreeNode } from "primereact/treenode";
import { createElement, type ReactNode, useState } from "react";
import type { ReadonlyDeep } from "type-fest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { KitchenwareDocContext, RecipeBookDocContext } from "../../../contexts/docContext.ts";
import { flushAsyncEffects } from "../../../testUtils.ts";
import type { IngredientSelectorProps } from "../../ingredients_table/IngredientSelector.tsx";
import type { InstructionIngredientSelectorProps } from "../InstructionIngredientSelector.tsx";
import {
  createPendingSectionEdits,
  type PendingEditResolutions,
  type PendingSectionEdits,
} from "../pendingEdits.ts";
import { RecipeVersionEditor } from "../RecipeVersionEditor.tsx";

const MOCK_CSV = `Unique ID,Type,Description,Default Measurement Type,Labels
------butter,ingredient,Butter,volume,fat+solid
-------flour,ingredient,Flour,volume,dry
`;

const BUTTER = fixedId(IngredientId, "butter");
const FLOUR = fixedId(IngredientId, "flour");
const OVEN = fixedId(EquipmentId, "oven");
const BOWL = fixedId(ContainerId, "bowl");

// Mock IngredientSelector so PrimeReact's TreeSelect doesn't run in jsdom.
vi.mock("../../ingredients_table/IngredientSelector.tsx", () => ({
  IngredientSelector: ({
    value,
    options,
    onChange,
    ariaLabel,
    placeholder,
  }: IngredientSelectorProps) => (
    <select
      aria-label={ariaLabel}
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v ? loadId(IngredientId, v) : undefined);
      }}
    >
      <option value="">{placeholder ?? "— None —"}</option>
      {options.map((ing) => (
        <option key={ing.id} value={ing.id}>
          {ing.name}
        </option>
      ))}
    </select>
  ),
}));

// Mock InstructionIngredientSelector to a flat checkbox per selectable
// ingredient, so instruction ingredient selection is testable in jsdom.
vi.mock("../InstructionIngredientSelector.tsx", () => ({
  InstructionIngredientSelector: ({
    nodes,
    selectedIds,
    onChange,
  }: InstructionIngredientSelectorProps) => {
    const leaves: Array<{ id: IngredientId; label: string }> = [];
    function collect(ns: TreeNode[]) {
      for (const n of ns) {
        const children = n.children;
        if (children && children.length > 0) {
          collect(children);
          continue;
        }
        const data: unknown = n.data;
        if (typeof data === "object" && data !== null && "ingredient_id" in data) {
          const raw = Reflect.get(data, "ingredient_id");
          if (typeof raw === "string") {
            leaves.push({ id: loadId(IngredientId, raw), label: String(n.label ?? "") });
          }
        }
      }
    }
    collect(nodes as TreeNode[]);
    return (
      <div role="group" aria-label="Instruction ingredients">
        {leaves.map((leaf) => {
          const checked = selectedIds.includes(leaf.id);
          return (
            <label key={leaf.id}>
              <input
                type="checkbox"
                aria-label={leaf.label}
                checked={checked}
                onChange={() =>
                  onChange(
                    checked
                      ? selectedIds.filter((id) => id !== leaf.id)
                      : [...selectedIds, leaf.id],
                  )
                }
              />
              {leaf.label}
            </label>
          );
        })}
      </div>
    );
  },
}));

let kitchenwareDoc: Y.Doc;
let recipeBookDoc: Y.Doc;

beforeEach(() => {
  kitchenwareDoc = new Y.Doc();
  recipeBookDoc = new Y.Doc();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ text: () => Promise.resolve(MOCK_CSV) }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeWrapper(kitchenware: Y.Doc, recipeBook: Y.Doc) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      KitchenwareDocContext.Provider,
      { value: { doc: kitchenware, whenSynced: Promise.resolve() } },
      createElement(
        RecipeBookDocContext.Provider,
        { value: { doc: recipeBook, whenSynced: Promise.resolve() } },
        children,
      ),
    );
  };
}

type HarnessProps = {
  readonly initialSections: ReadonlyDeep<Section[]>;
  readonly pendingEdits?: PendingSectionEdits | undefined;
  readonly onSectionsChange?: ((sections: ReadonlyDeep<Section[]>) => void) | undefined;
};

/** Owns the section state the way the recipe editor page does. */
function Harness({ initialSections, pendingEdits, onSectionsChange }: HarnessProps) {
  const [sections, setSections] = useState<ReadonlyDeep<Section[]>>(initialSections);
  return (
    <RecipeVersionEditor
      sections={sections}
      pendingEdits={pendingEdits}
      onChange={(next) => {
        setSections(next);
        onSectionsChange?.(next);
      }}
    />
  );
}

type SectionsChangeSpy = ReturnType<typeof vi.fn<(sections: ReadonlyDeep<Section[]>) => void>>;

function setup(sections: ReadonlyDeep<Section[]>, pendingEdits?: PendingSectionEdits) {
  const onSectionsChange: SectionsChangeSpy = vi.fn();
  render(
    <Harness
      initialSections={sections}
      pendingEdits={pendingEdits}
      onSectionsChange={onSectionsChange}
    />,
    { wrapper: makeWrapper(kitchenwareDoc, recipeBookDoc) },
  );
  return { onSectionsChange };
}

/**
 * Runs a registry resolution inside `act(...)` — closing the rows' editors
 * updates their state — and hands back its result, which `act` itself drops.
 */
function resolveInAct(resolve: () => PendingEditResolutions): PendingEditResolutions {
  let resolutions: PendingEditResolutions | undefined;
  act(() => {
    resolutions = resolve();
  });
  assertDefined(resolutions, "expected the registry to return its resolutions");
  return resolutions;
}

/** The sections the harness last handed back, i.e. what a page save would use. */
function lastSections(onSectionsChange: SectionsChangeSpy): ReadonlyDeep<Section[]> | undefined {
  return onSectionsChange.mock.calls.at(-1)?.[0];
}

const MIX_ID = fixedId(SectionItemId, "i-mix");
const BOWL_ID = fixedId(SectionItemId, "c-bowl");
const SECTION_ID = fixedId(SectionItemId, "s-main");

function sectionWith(contents: ReadonlyDeep<Section["contents"]>): ReadonlyDeep<Section[]> {
  return [{ kind: "section", id: SECTION_ID, header: "Main", contents }];
}

const MIX_INSTRUCTION = {
  kind: "instruction",
  id: MIX_ID,
  instruction: "Mix",
  duration_seconds: 300,
} as const;

const BOWL_CONTAINER = {
  kind: "container",
  id: BOWL_ID,
  container_id: BOWL,
  descriptor: "dry ingredients",
  contents: [],
} as const;

// ---------------------------------------------------------------------------
// InstructionRow
// ---------------------------------------------------------------------------

describe("InstructionRow — summary view", () => {
  it("renders an existing instruction as a summary, not an editor", async () => {
    setup(sectionWith([MIX_INSTRUCTION]));
    await flushAsyncEffects();

    expect(screen.getByRole("group", { name: "Instruction: Mix" })).toHaveTextContent(
      "Mix for 5 minutes",
    );
    expect(screen.queryByRole("textbox", { name: "Action" })).not.toBeInTheDocument();
  });

  it("opens the editor from the row's edit button", async () => {
    setup(sectionWith([MIX_INSTRUCTION]));
    await userEvent.click(screen.getByRole("button", { name: "Edit instruction: Mix" }));

    expect(screen.getByRole("textbox", { name: "Action" })).toHaveValue("Mix");
  });

  it("names the action input from its visible label", async () => {
    setup(sectionWith([MIX_INSTRUCTION]));
    await userEvent.click(screen.getByRole("button", { name: "Edit instruction: Mix" }));

    expect(screen.queryByRole("textbox", { name: "Instruction text" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Action" })).toBeInTheDocument();
  });

  it("opens a newly added instruction directly in edit mode", async () => {
    setup(sectionWith([]));
    await userEvent.click(screen.getByRole("button", { name: "Add instruction to section" }));

    expect(screen.getByRole("textbox", { name: "Action" })).toHaveValue("");
  });

  it("bolds the action name in the summary", async () => {
    setup(sectionWith([MIX_INSTRUCTION]));
    await flushAsyncEffects();

    const row = screen.getByRole("group", { name: "Instruction: Mix" });
    expect(within(row).getByText("Mix").tagName).toBe("STRONG");
    expect(within(row).getByText("for 5 minutes").tagName).toBe("SPAN");
  });
});

describe("InstructionRow — accept and cancel", () => {
  it("does not commit edits until they are accepted", async () => {
    const { onSectionsChange } = setup(sectionWith([MIX_INSTRUCTION]));
    await userEvent.click(screen.getByRole("button", { name: "Edit instruction: Mix" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Action" }), "ing");

    expect(onSectionsChange).not.toHaveBeenCalled();
  });

  it("commits the draft and closes the editor on accept", async () => {
    const { onSectionsChange } = setup(sectionWith([MIX_INSTRUCTION]));
    await userEvent.click(screen.getByRole("button", { name: "Edit instruction: Mix" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Action" }), "ing");
    await userEvent.click(screen.getByRole("button", { name: "Accept changes to instruction" }));

    expect(screen.getByRole("button", { name: "Edit instruction: Mixing" })).toBeInTheDocument();
    expect(lastSections(onSectionsChange)?.[0]?.contents[0]).toMatchObject({
      instruction: "Mixing",
      duration_seconds: 300,
    });
  });

  it("reverts the draft and closes the editor on cancel", async () => {
    const { onSectionsChange } = setup(sectionWith([MIX_INSTRUCTION]));
    await userEvent.click(screen.getByRole("button", { name: "Edit instruction: Mix" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Action" }), "ing");
    await userEvent.click(screen.getByRole("button", { name: "Cancel changes to instruction" }));

    expect(screen.getByRole("button", { name: "Edit instruction: Mix" })).toBeInTheDocument();
    expect(onSectionsChange).not.toHaveBeenCalled();
  });

  it("re-opens the editor with the reverted value after a cancel", async () => {
    setup(sectionWith([MIX_INSTRUCTION]));
    await userEvent.click(screen.getByRole("button", { name: "Edit instruction: Mix" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Action" }), "ing");
    await userEvent.click(screen.getByRole("button", { name: "Cancel changes to instruction" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit instruction: Mix" }));

    expect(screen.getByRole("textbox", { name: "Action" })).toHaveValue("Mix");
  });

  it("removes a newly added instruction when its first edit is cancelled", async () => {
    const { onSectionsChange } = setup(sectionWith([]));
    await userEvent.click(screen.getByRole("button", { name: "Add instruction to section" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Action" }), "Fold");
    await userEvent.click(screen.getByRole("button", { name: "Discard new instruction" }));

    expect(screen.queryByRole("textbox", { name: "Action" })).not.toBeInTheDocument();
    expect(lastSections(onSectionsChange)?.[0]?.contents).toHaveLength(0);
  });

  it("reverts instead of removing once a newly added instruction has been accepted", async () => {
    const { onSectionsChange } = setup(sectionWith([]));
    await userEvent.click(screen.getByRole("button", { name: "Add instruction to section" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Action" }), "Fold");
    await userEvent.click(screen.getByRole("button", { name: "Accept changes to instruction" }));

    await userEvent.click(screen.getByRole("button", { name: "Edit instruction: Fold" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Action" }), "ed");
    await userEvent.click(screen.getByRole("button", { name: "Cancel changes to instruction" }));

    expect(screen.getByRole("button", { name: "Edit instruction: Fold" })).toBeInTheDocument();
    expect(lastSections(onSectionsChange)?.[0]?.contents).toHaveLength(1);
  });

  it("collapses an existing blank instruction instead of opening its editor", async () => {
    const blank = { kind: "instruction", id: MIX_ID, instruction: "" } as const;
    setup(sectionWith([blank]));
    await flushAsyncEffects();

    expect(screen.queryByRole("textbox", { name: "Action" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit instruction: instruction" }),
    ).toBeInTheDocument();
  });

  it("lets an existing blank instruction be cancelled without removing it", async () => {
    const blank = { kind: "instruction", id: MIX_ID, instruction: "" } as const;
    const { onSectionsChange } = setup(sectionWith([blank]));
    await userEvent.click(screen.getByRole("button", { name: "Edit instruction: instruction" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Action" }), "Rest");
    await userEvent.click(screen.getByRole("button", { name: "Cancel changes to instruction" }));

    expect(
      screen.getByRole("button", { name: "Edit instruction: instruction" }),
    ).toBeInTheDocument();
    expect(onSectionsChange).not.toHaveBeenCalled();
  });

  it("commits a duration removed in the draft", async () => {
    const { onSectionsChange } = setup(sectionWith([MIX_INSTRUCTION]));
    await userEvent.click(screen.getByRole("button", { name: "Edit instruction: Mix" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove duration" }));
    await userEvent.click(screen.getByRole("button", { name: "Accept changes to instruction" }));

    expect(lastSections(onSectionsChange)?.[0]?.contents[0]).not.toHaveProperty("duration_seconds");
  });

  it("commits equipment selected in the draft", async () => {
    const { onSectionsChange } = setup(sectionWith([MIX_INSTRUCTION]));
    await userEvent.click(screen.getByRole("button", { name: "Edit instruction: Mix" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Equipment" }), OVEN);
    await userEvent.click(screen.getByRole("button", { name: "Accept changes to instruction" }));

    expect(lastSections(onSectionsChange)?.[0]?.contents[0]).toMatchObject({
      equipment_id: OVEN,
    });
  });

  it("commits equipment cleared in the draft", async () => {
    const baked = { ...MIX_INSTRUCTION, equipment_id: OVEN } as const;
    const { onSectionsChange } = setup(sectionWith([baked]));
    await userEvent.click(screen.getByRole("button", { name: "Edit instruction: Mix" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Equipment" }), "");
    await userEvent.click(screen.getByRole("button", { name: "Accept changes to instruction" }));

    expect(lastSections(onSectionsChange)?.[0]?.contents[0]).not.toHaveProperty("equipment_id");
  });

  it("commits ingredients selected in the draft", async () => {
    const withButter = sectionWith([
      { kind: "ingredient", id: fixedId(SectionItemId, "i-butter"), ingredient_id: BUTTER },
      MIX_INSTRUCTION,
    ]);
    const { onSectionsChange } = setup(withButter);
    await flushAsyncEffects();

    await userEvent.click(screen.getByRole("button", { name: "Edit instruction: Mix" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Butter" }));
    await userEvent.click(screen.getByRole("button", { name: "Accept changes to instruction" }));

    expect(lastSections(onSectionsChange)?.[0]?.contents[1]).toMatchObject({
      ingredient_ids: [BUTTER],
    });
  });
});

// ---------------------------------------------------------------------------
// ContainerItemRow
// ---------------------------------------------------------------------------

describe("ContainerItemRow — summary view", () => {
  it("renders an existing container as a summary, not an editor", async () => {
    setup(sectionWith([BOWL_CONTAINER]));
    await flushAsyncEffects();

    expect(screen.getByRole("group", { name: /Container: Bowl/ })).toHaveTextContent(
      "Bowl — dry ingredients",
    );
    expect(screen.queryByRole("textbox", { name: "Name" })).not.toBeInTheDocument();
  });

  it("marks ordered containers in the summary", async () => {
    setup(sectionWith([{ ...BOWL_CONTAINER, ordered: true }]));
    await flushAsyncEffects();

    expect(screen.getByRole("group", { name: /Container: Bowl/ })).toHaveTextContent(
      "Bowl — dry ingredients (ordered)",
    );
  });

  it("opens the editor from the row's edit button", async () => {
    setup(sectionWith([BOWL_CONTAINER]));
    await userEvent.click(screen.getByRole("button", { name: "Edit container: Bowl" }));

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("dry ingredients");
  });

  it("opens a newly added container directly in edit mode", async () => {
    setup(sectionWith([]));
    await userEvent.click(screen.getByRole("button", { name: "Add container to section" }));

    expect(screen.getByRole("combobox", { name: "Type" })).toBeInTheDocument();
  });

  it("hides the name input behind a + Name button until the container has one", async () => {
    setup(sectionWith([]));
    await userEvent.click(screen.getByRole("button", { name: "Add container to section" }));
    expect(screen.queryByRole("textbox", { name: "Name" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Add container name" }));
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("");
  });

  it("shows the name input straight away for a container that already has a name", async () => {
    setup(sectionWith([BOWL_CONTAINER]));
    await userEvent.click(screen.getByRole("button", { name: "Edit container: Bowl" }));

    expect(screen.queryByRole("button", { name: "Add container name" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("dry ingredients");
  });

  it("explains the ordered flag behind an info toggle", async () => {
    const explanation = "Annotates that the ingredients should be added in the specified order";
    setup(sectionWith([BOWL_CONTAINER]));
    await userEvent.click(screen.getByRole("button", { name: "Edit container: Bowl" }));
    expect(screen.queryByText(explanation)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "What does ordered mean?" }));
    expect(screen.getByText(explanation)).toBeInTheDocument();
  });

  it("bolds the container type in the summary", async () => {
    setup(sectionWith([BOWL_CONTAINER]));
    await flushAsyncEffects();

    const row = screen.getByRole("group", { name: /Container: Bowl/ });
    expect(within(row).getByText("Bowl").tagName).toBe("STRONG");
  });

  it("keeps nested ingredients visible while the header is collapsed", async () => {
    const filled = {
      ...BOWL_CONTAINER,
      contents: [
        { kind: "ingredient", id: fixedId(SectionItemId, "i-butter"), ingredient_id: BUTTER },
      ],
    } as const;
    setup(sectionWith([filled]));
    await flushAsyncEffects();

    const containerGroup = screen.getByRole("group", { name: /Container: Bowl/ });
    expect(
      within(containerGroup).getByRole("group", { name: "Ingredient: Butter" }),
    ).toBeInTheDocument();
  });
});

describe("ContainerItemRow — accept and cancel", () => {
  it("does not commit header edits until they are accepted", async () => {
    const { onSectionsChange } = setup(sectionWith([BOWL_CONTAINER]));
    await userEvent.click(screen.getByRole("button", { name: "Edit container: Bowl" }));
    await userEvent.clear(screen.getByRole("textbox", { name: "Name" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "wet ingredients");

    expect(onSectionsChange).not.toHaveBeenCalled();
  });

  it("commits the draft and closes the editor on accept", async () => {
    const { onSectionsChange } = setup(sectionWith([BOWL_CONTAINER]));
    await userEvent.click(screen.getByRole("button", { name: "Edit container: Bowl" }));
    await userEvent.clear(screen.getByRole("textbox", { name: "Name" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "wet ingredients");
    await userEvent.click(screen.getByRole("button", { name: "Accept changes to container" }));

    expect(screen.getByRole("group", { name: /Container: Bowl/ })).toHaveTextContent(
      "Bowl — wet ingredients",
    );
    expect(lastSections(onSectionsChange)?.[0]?.contents[0]).toMatchObject({
      descriptor: "wet ingredients",
    });
  });

  it("commits the container type and ordered flag on accept", async () => {
    const { onSectionsChange } = setup(sectionWith([BOWL_CONTAINER]));
    await userEvent.click(screen.getByRole("button", { name: "Edit container: Bowl" }));
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Type" }),
      fixedId(ContainerId, "pot"),
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "Ordered list" }));
    await userEvent.click(screen.getByRole("button", { name: "Accept changes to container" }));

    expect(lastSections(onSectionsChange)?.[0]?.contents[0]).toMatchObject({
      container_id: fixedId(ContainerId, "pot"),
      ordered: true,
    });
  });

  it("reverts the draft and closes the editor on cancel", async () => {
    const { onSectionsChange } = setup(sectionWith([BOWL_CONTAINER]));
    await userEvent.click(screen.getByRole("button", { name: "Edit container: Bowl" }));
    await userEvent.clear(screen.getByRole("textbox", { name: "Name" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "wet ingredients");
    await userEvent.click(screen.getByRole("button", { name: "Cancel changes to container" }));

    expect(screen.getByRole("group", { name: /Container: Bowl/ })).toHaveTextContent(
      "Bowl — dry ingredients",
    );
    expect(onSectionsChange).not.toHaveBeenCalled();
  });

  it("removes a newly added container when its first edit is cancelled", async () => {
    const { onSectionsChange } = setup(sectionWith([]));
    await userEvent.click(screen.getByRole("button", { name: "Add container to section" }));
    await userEvent.click(screen.getByRole("button", { name: "Add container name" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "wet ingredients");
    await userEvent.click(screen.getByRole("button", { name: "Discard new container" }));

    expect(screen.queryByRole("textbox", { name: "Name" })).not.toBeInTheDocument();
    expect(lastSections(onSectionsChange)?.[0]?.contents).toHaveLength(0);
  });

  it("keeps ingredients added while the header editor is open", async () => {
    const { onSectionsChange } = setup(sectionWith([BOWL_CONTAINER]));
    await flushAsyncEffects();

    await userEvent.click(screen.getByRole("button", { name: "Edit container: Bowl" }));
    await userEvent.click(screen.getByRole("button", { name: "Add ingredient to Bowl" }));
    const newIngredient = screen.getByRole("group", { name: "New ingredient" });
    await userEvent.selectOptions(
      within(newIngredient).getByRole("combobox", { name: "Select new ingredient" }),
      BUTTER,
    );
    await userEvent.click(
      within(newIngredient).getByRole("button", { name: /Add Butter to section/ }),
    );

    await userEvent.clear(screen.getByRole("textbox", { name: "Name" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "wet");
    await userEvent.click(screen.getByRole("button", { name: "Accept changes to container" }));

    expect(lastSections(onSectionsChange)?.[0]?.contents[0]).toMatchObject({
      descriptor: "wet",
      contents: [{ ingredient_id: BUTTER }],
    });
  });
});

// ---------------------------------------------------------------------------
// IngredientItemRow
// ---------------------------------------------------------------------------

const BUTTER_ITEM = {
  kind: "ingredient",
  id: fixedId(SectionItemId, "i-butter"),
  ingredient_id: BUTTER,
} as const;

/** Opens the Butter row's inline editor, waiting for the kitchenware to load. */
async function openButterEditor() {
  await flushAsyncEffects();
  await userEvent.click(screen.getByRole("button", { name: "Edit ingredient: Butter" }));
  return screen.getByRole("combobox", { name: /Change ingredient/ });
}

describe("IngredientItemRow", () => {
  it("shows an edit button before the remove button while collapsed", async () => {
    setup(sectionWith([BUTTER_ITEM]));
    await flushAsyncEffects();

    const row = screen.getByRole("group", { name: "Ingredient: Butter" });
    expect(
      within(row)
        .getAllByRole("button")
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual(["Edit ingredient: Butter", "Remove ingredient Butter"]);
  });

  it("replaces the edit button with accept and cancel while editing", async () => {
    setup(sectionWith([BUTTER_ITEM]));
    await openButterEditor();

    expect(
      screen.getByRole("button", { name: "Accept changes to ingredient" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel changes to ingredient" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit ingredient: Butter" }),
    ).not.toBeInTheDocument();
  });

  it("shows a changed ingredient name immediately", async () => {
    setup(sectionWith([BUTTER_ITEM]));
    const selector = await openButterEditor();
    await userEvent.selectOptions(selector, FLOUR);

    expect(screen.getByRole("group", { name: "Ingredient: Flour" })).toBeInTheDocument();
  });

  it("keeps the changed ingredient on accept", async () => {
    const { onSectionsChange } = setup(sectionWith([BUTTER_ITEM]));
    const selector = await openButterEditor();
    await userEvent.selectOptions(selector, FLOUR);
    await userEvent.click(screen.getByRole("button", { name: "Accept changes to ingredient" }));

    expect(screen.getByRole("button", { name: "Edit ingredient: Flour" })).toBeInTheDocument();
    expect(lastSections(onSectionsChange)?.[0]?.contents[0]).toMatchObject({
      ingredient_id: FLOUR,
    });
  });

  it("reverts the changed ingredient on cancel", async () => {
    const { onSectionsChange } = setup(sectionWith([BUTTER_ITEM]));
    const selector = await openButterEditor();
    await userEvent.selectOptions(selector, FLOUR);
    await userEvent.click(screen.getByRole("button", { name: "Cancel changes to ingredient" }));

    expect(screen.getByRole("button", { name: "Edit ingredient: Butter" })).toBeInTheDocument();
    expect(lastSections(onSectionsChange)?.[0]?.contents[0]).toMatchObject({
      ingredient_id: BUTTER,
    });
  });
});

// ---------------------------------------------------------------------------
// Row actions shared across every section item
// ---------------------------------------------------------------------------

describe("row actions", () => {
  it.each([
    ["Ingredient: Butter", ["Edit ingredient: Butter", "Remove ingredient Butter"]],
    ["Instruction: Mix", ["Edit instruction: Mix", "Remove instruction"]],
    ["Text block", ["Edit text block", "Remove text block"]],
  ])("puts edit before remove on the %s row", async (rowName, expected) => {
    setup(
      sectionWith([
        BUTTER_ITEM,
        MIX_INSTRUCTION,
        { kind: "text_block", id: fixedId(SectionItemId, "t-1"), text: "Rest overnight" },
      ]),
    );
    await flushAsyncEffects();

    const row = screen.getByRole("group", { name: rowName });
    expect(
      within(row)
        .getAllByRole("button")
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual(expected);
  });

  it("puts edit before remove on the container row", async () => {
    setup(sectionWith([BOWL_CONTAINER]));
    await flushAsyncEffects();

    const row = screen.getByRole("group", { name: /Container: Bowl/ });
    const [edit, remove] = within(row).getAllByRole("button");
    expect(edit).toHaveAccessibleName("Edit container: Bowl");
    expect(remove).toHaveAccessibleName("Remove container Bowl");
  });

  it("puts edit before remove on the section header row", async () => {
    setup(sectionWith([]));
    await flushAsyncEffects();

    expect(
      screen
        .getAllByRole("button")
        .map((b) => b.getAttribute("aria-label"))
        .filter((label) => label === "Edit section header: Main" || label === "Remove section"),
    ).toEqual(["Edit section header: Main", "Remove section"]);
  });

  it("removes a row from its ✕", async () => {
    const { onSectionsChange } = setup(sectionWith([MIX_INSTRUCTION]));
    await flushAsyncEffects();
    await userEvent.click(screen.getByRole("button", { name: "Remove instruction" }));

    expect(lastSections(onSectionsChange)?.[0]?.contents).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TextBlockRow
// ---------------------------------------------------------------------------

const TEXT_BLOCK = {
  kind: "text_block",
  id: fixedId(SectionItemId, "t-1"),
  text: "Rest overnight",
} as const;

describe("TextBlockRow", () => {
  it("renders an existing block as its text, not an editor", async () => {
    setup(sectionWith([TEXT_BLOCK]));
    await flushAsyncEffects();

    expect(screen.getByRole("group", { name: "Text block" })).toHaveTextContent("Rest overnight");
    expect(screen.queryByRole("textbox", { name: "Text block content" })).not.toBeInTheDocument();
  });

  it("opens the editor from the row's edit button", async () => {
    setup(sectionWith([TEXT_BLOCK]));
    await userEvent.click(screen.getByRole("button", { name: "Edit text block" }));

    expect(screen.getByRole("textbox", { name: "Text block content" })).toHaveValue(
      "Rest overnight",
    );
  });

  it("opens a newly added block directly in edit mode", async () => {
    setup(sectionWith([]));
    await userEvent.click(screen.getByRole("button", { name: "Add text block to section" }));

    expect(screen.getByRole("textbox", { name: "Text block content" })).toHaveValue("");
  });

  it("keeps the edited text on accept", async () => {
    const { onSectionsChange } = setup(sectionWith([TEXT_BLOCK]));
    await userEvent.click(screen.getByRole("button", { name: "Edit text block" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Text block content" }), " in a bowl");
    await userEvent.click(screen.getByRole("button", { name: "Accept changes to text" }));

    expect(screen.getByRole("group", { name: "Text block" })).toHaveTextContent(
      "Rest overnight in a bowl",
    );
    expect(lastSections(onSectionsChange)?.[0]?.contents[0]).toMatchObject({
      text: "Rest overnight in a bowl",
    });
  });

  it("does not commit edits until they are accepted", async () => {
    const { onSectionsChange } = setup(sectionWith([TEXT_BLOCK]));
    await userEvent.click(screen.getByRole("button", { name: "Edit text block" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Text block content" }), " in a bowl");

    expect(onSectionsChange).not.toHaveBeenCalled();
  });

  it("reverts the draft and closes the editor on cancel", async () => {
    const { onSectionsChange } = setup(sectionWith([TEXT_BLOCK]));
    await userEvent.click(screen.getByRole("button", { name: "Edit text block" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Text block content" }), " in a bowl");
    await userEvent.click(screen.getByRole("button", { name: "Cancel changes to text" }));

    expect(screen.getByRole("group", { name: "Text block" })).toHaveTextContent("Rest overnight");
    expect(onSectionsChange).not.toHaveBeenCalled();
  });

  it("re-opens the editor with the reverted text after a cancel", async () => {
    setup(sectionWith([TEXT_BLOCK]));
    await userEvent.click(screen.getByRole("button", { name: "Edit text block" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Text block content" }), " in a bowl");
    await userEvent.click(screen.getByRole("button", { name: "Cancel changes to text" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit text block" }));

    expect(screen.getByRole("textbox", { name: "Text block content" })).toHaveValue(
      "Rest overnight",
    );
  });

  it("collapses a block that was accepted while still empty", async () => {
    const empty = { kind: "text_block", id: fixedId(SectionItemId, "t-1"), text: "" } as const;
    setup(sectionWith([empty]));
    await flushAsyncEffects();

    expect(screen.queryByRole("textbox", { name: "Text block content" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Text block" })).toHaveTextContent(
      "Untitled text block",
    );
  });

  it("removes a newly added block when its first edit is cancelled", async () => {
    const { onSectionsChange } = setup(sectionWith([]));
    await userEvent.click(screen.getByRole("button", { name: "Add text block to section" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Text block content" }), "Chill");
    await userEvent.click(screen.getByRole("button", { name: "Discard new text block" }));

    expect(lastSections(onSectionsChange)?.[0]?.contents).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// New (unaccepted) rows
// ---------------------------------------------------------------------------

describe("newly added rows", () => {
  it.each([
    ["Add instruction to section", "Instruction: new"],
    ["Add text block to section", "Text block"],
  ])("renders a dashed border after %s", async (addButton, rowName) => {
    setup(sectionWith([]));
    await userEvent.click(screen.getByRole("button", { name: addButton }));

    expect(screen.getByRole("group", { name: rowName })).toHaveClass("re-item--new");
  });

  it("renders a dashed border on a new container", async () => {
    setup(sectionWith([]));
    await userEvent.click(screen.getByRole("button", { name: "Add container to section" }));

    expect(screen.getByRole("group", { name: /Container: Bowl/ })).toHaveClass("re-item--new");
  });

  it("drops the dashed border once the row is accepted", async () => {
    setup(sectionWith([]));
    await userEvent.click(screen.getByRole("button", { name: "Add instruction to section" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Action" }), "Fold");
    await userEvent.click(screen.getByRole("button", { name: "Accept changes to instruction" }));

    expect(screen.getByRole("group", { name: "Instruction: Fold" })).not.toHaveClass(
      "re-item--new",
    );
  });

  it("leaves an existing row solid", async () => {
    setup(sectionWith([MIX_INSTRUCTION]));
    await flushAsyncEffects();

    expect(screen.getByRole("group", { name: "Instruction: Mix" })).not.toHaveClass("re-item--new");
  });
});

// ---------------------------------------------------------------------------
// SectionEditor — header
// ---------------------------------------------------------------------------

describe("SectionEditor — header", () => {
  it("renders an existing header as a summary, not an input", async () => {
    setup(sectionWith([]));
    await flushAsyncEffects();

    expect(screen.getByRole("group", { name: "Section: Main" })).toHaveTextContent("Main");
    expect(screen.queryByRole("textbox", { name: "Section header" })).not.toBeInTheDocument();
  });

  it("opens the header editor with accept and cancel buttons", async () => {
    setup(sectionWith([]));
    await userEvent.click(screen.getByRole("button", { name: "Edit section header: Main" }));

    expect(screen.getByRole("textbox", { name: "Section header" })).toHaveValue("Main");
    expect(
      screen.getByRole("button", { name: "Accept changes to section header" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel changes to section header" }),
    ).toBeInTheDocument();
  });

  it("keeps the edited header on accept", async () => {
    const { onSectionsChange } = setup(sectionWith([]));
    await userEvent.click(screen.getByRole("button", { name: "Edit section header: Main" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Section header" }), " Dish");
    await userEvent.click(screen.getByRole("button", { name: "Accept changes to section header" }));

    expect(
      screen.getByRole("button", { name: "Edit section header: Main Dish" }),
    ).toBeInTheDocument();
    expect(lastSections(onSectionsChange)?.[0]?.header).toBe("Main Dish");
  });

  it("restores the header the section had when the editor opened on cancel", async () => {
    const { onSectionsChange } = setup(sectionWith([]));
    await userEvent.click(screen.getByRole("button", { name: "Edit section header: Main" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Section header" }), " Dish");
    await userEvent.click(screen.getByRole("button", { name: "Cancel changes to section header" }));

    expect(screen.getByRole("button", { name: "Edit section header: Main" })).toBeInTheDocument();
    expect(lastSections(onSectionsChange)?.[0]?.header).toBe("Main");
  });

  it("drops a header that was added and then cancelled", async () => {
    const { onSectionsChange } = setup([{ kind: "section", id: SECTION_ID, contents: [] }]);
    await userEvent.click(screen.getByRole("button", { name: "Add section header" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Section header" }), "Sauce");
    await userEvent.click(screen.getByRole("button", { name: "Cancel changes to section header" }));

    expect(screen.getByRole("button", { name: "Add section header" })).toBeInTheDocument();
    expect(lastSections(onSectionsChange)?.[0]).not.toHaveProperty("header");
  });
});

// ---------------------------------------------------------------------------
// Pending edits registry
// ---------------------------------------------------------------------------

describe("pending row edits", () => {
  it("registers a row whose draft has uncommitted changes", async () => {
    const pendingEdits = createPendingSectionEdits();
    setup(sectionWith([MIX_INSTRUCTION]), pendingEdits);

    await userEvent.click(screen.getByRole("button", { name: "Edit instruction: Mix" }));
    expect(pendingEdits.pendingCount()).toBe(0);

    await userEvent.type(screen.getByRole("textbox", { name: "Action" }), "ing");
    expect(pendingEdits.pendingCount()).toBe(1);
  });

  it("registers a newly added row even before it is touched", async () => {
    const pendingEdits = createPendingSectionEdits();
    setup(sectionWith([]), pendingEdits);

    await userEvent.click(screen.getByRole("button", { name: "Add instruction to section" }));
    expect(pendingEdits.pendingCount()).toBe(1);
  });

  it("unregisters a row once its draft is accepted", async () => {
    const pendingEdits = createPendingSectionEdits();
    setup(sectionWith([MIX_INSTRUCTION]), pendingEdits);

    await userEvent.click(screen.getByRole("button", { name: "Edit instruction: Mix" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Action" }), "ing");
    await userEvent.click(screen.getByRole("button", { name: "Accept changes to instruction" }));

    expect(pendingEdits.pendingCount()).toBe(0);
  });

  it("unregisters a row once its draft is cancelled", async () => {
    const pendingEdits = createPendingSectionEdits();
    setup(sectionWith([MIX_INSTRUCTION]), pendingEdits);

    await userEvent.click(screen.getByRole("button", { name: "Edit instruction: Mix" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Action" }), "ing");
    await userEvent.click(screen.getByRole("button", { name: "Cancel changes to instruction" }));

    expect(pendingEdits.pendingCount()).toBe(0);
  });

  it("tracks instruction and container drafts that are open at the same time", async () => {
    const pendingEdits = createPendingSectionEdits();
    setup(sectionWith([BOWL_CONTAINER, MIX_INSTRUCTION]), pendingEdits);

    await userEvent.click(screen.getByRole("button", { name: "Edit container: Bowl" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "!");
    await userEvent.click(screen.getByRole("button", { name: "Edit instruction: Mix" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Action" }), "ing");

    expect(pendingEdits.pendingCount()).toBe(2);
  });

  it("builds one update per pending row and closes their editors on acceptAll", async () => {
    const pendingEdits = createPendingSectionEdits();
    setup(sectionWith([BOWL_CONTAINER, MIX_INSTRUCTION]), pendingEdits);

    await userEvent.click(screen.getByRole("button", { name: "Edit container: Bowl" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "!");
    await userEvent.click(screen.getByRole("button", { name: "Edit instruction: Mix" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Action" }), "ing");

    // Resolving pending edits closes the rows' editors, so it updates state.
    const { updates, removals } = resolveInAct(() => pendingEdits.acceptAll());
    expect(removals.size).toBe(0);
    expect(updates.get(BOWL_ID)).toMatchObject({ descriptor: "dry ingredients!" });
    expect(updates.get(MIX_ID)).toMatchObject({ instruction: "Mixing" });
  });

  it("reports newly added rows as removals on discardAll", async () => {
    const pendingEdits = createPendingSectionEdits();
    setup(sectionWith([MIX_INSTRUCTION]), pendingEdits);

    await userEvent.click(screen.getByRole("button", { name: "Add instruction to section" }));
    const newRow = screen.getByRole("group", { name: "Instruction: new" });
    await userEvent.type(within(newRow).getByRole("textbox", { name: "Action" }), "Fold");
    await userEvent.click(screen.getByRole("button", { name: "Edit instruction: Mix" }));
    const mixRow = screen.getByRole("group", { name: "Instruction: Mix" });
    await userEvent.type(within(mixRow).getByRole("textbox", { name: "Action" }), "ing");

    const { updates, removals } = resolveInAct(() => pendingEdits.discardAll());
    expect(updates.size).toBe(0);
    expect(removals.has(MIX_ID)).toBe(false);
    expect(removals.size).toBe(1);
  });

  it("closes every open editor on discardAll", async () => {
    const pendingEdits = createPendingSectionEdits();
    setup(sectionWith([MIX_INSTRUCTION]), pendingEdits);

    await userEvent.click(screen.getByRole("button", { name: "Edit instruction: Mix" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Action" }), "ing");

    await flushAsyncEffects();
    act(() => {
      pendingEdits.discardAll();
    });
    await flushAsyncEffects();

    expect(screen.getByRole("button", { name: "Edit instruction: Mix" })).toBeInTheDocument();
    expect(pendingEdits.pendingCount()).toBe(0);
  });

  it("does not track drafts when no registry is provided", async () => {
    setup(sectionWith([MIX_INSTRUCTION]));
    await userEvent.click(screen.getByRole("button", { name: "Edit instruction: Mix" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Action" }), "ing");

    expect(screen.getByRole("textbox", { name: "Action" })).toHaveValue("Mixing");
  });
});
