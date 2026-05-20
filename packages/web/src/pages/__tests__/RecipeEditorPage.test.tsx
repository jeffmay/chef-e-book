import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import * as Y from "yjs";
import { DocContext } from "../../contexts/doc_context.js";
import { RecipeEditorPage } from "../recipe_editor_page.js";

const MOCK_CSV = `Unique ID,Type,Description,Default Measurement Type,Labels
------butter,ingredient,Butter,volume,fat+solid
------flour,ingredient,Flour,volume,dry
`;

function makeWrapper(doc: Y.Doc) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(DocContext.Provider, { value: doc }, children);
  };
}

let doc: Y.Doc;

beforeEach(() => {
  doc = new Y.Doc();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ text: () => Promise.resolve(MOCK_CSV) }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup() {
  return render(<RecipeEditorPage userName="test-user" />, { wrapper: makeWrapper(doc) });
}

describe("RecipeEditorPage — list view", () => {
  it("renders the Recipes heading", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Recipes" })).toBeInTheDocument();
  });

  it("shows the + New recipe button", () => {
    setup();
    expect(screen.getByRole("button", { name: "New recipe" })).toBeInTheDocument();
  });

  it("shows empty state when no recipes exist", () => {
    setup();
    expect(screen.getByText(/No recipes yet/i)).toBeInTheDocument();
  });
});

describe("RecipeEditorPage — new recipe form", () => {
  it("opens the recipe editor when + New recipe is clicked", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New recipe" }));
    expect(screen.getByRole("main", { name: "Recipe editor" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "New Recipe" })).toBeInTheDocument();
  });

  it("shows all required fields in the editor", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New recipe" }));
    expect(screen.getByRole("textbox", { name: "Recipe title" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Recipe subtitle" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Source URL" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Version description" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Parent folder" })).toBeInTheDocument();
  });

  it("Save button is disabled when title is empty", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New recipe" }));
    expect(screen.getByRole("button", { name: "Save recipe" })).toBeDisabled();
  });

  it("Save button is enabled when title is filled in", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New recipe" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Recipe title" }), "Chocolate Cake");
    expect(screen.getByRole("button", { name: "Save recipe" })).not.toBeDisabled();
  });

  it("creates a recipe and returns to the list", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New recipe" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Recipe title" }), "Chocolate Cake");
    await userEvent.click(screen.getByRole("button", { name: "Save recipe" }));
    expect(screen.getByRole("heading", { name: "Recipes" })).toBeInTheDocument();
    expect(screen.getByText("Chocolate Cake")).toBeInTheDocument();
  });

  it("Cancel returns to the list without saving", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New recipe" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Recipe title" }), "Draft Recipe");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("heading", { name: "Recipes" })).toBeInTheDocument();
    expect(screen.queryByText("Draft Recipe")).not.toBeInTheDocument();
  });

  it("← Back returns to the list without saving", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New recipe" }));
    await userEvent.click(screen.getByRole("button", { name: "Back to recipe list" }));
    expect(screen.getByRole("heading", { name: "Recipes" })).toBeInTheDocument();
  });
});

describe("RecipeEditorPage — editing existing recipe", () => {
  async function create_and_edit(title: string) {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New recipe" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Recipe title" }), title);
    await userEvent.click(screen.getByRole("button", { name: "Save recipe" }));
    await userEvent.click(screen.getByRole("button", { name: `Edit recipe: ${title}` }));
  }

  it("opens the editor for an existing recipe", async () => {
    await create_and_edit("Banana Bread");
    expect(screen.getByRole("heading", { name: "Edit: Banana Bread" })).toBeInTheDocument();
  });

  it("shows version history for existing recipe", async () => {
    await create_and_edit("Banana Bread");
    expect(screen.getByText(/Version history/i)).toBeInTheDocument();
  });

  it("shows the 'Create a new version' checkbox when editing", async () => {
    await create_and_edit("Banana Bread");
    expect(screen.getByRole("checkbox", { name: "Create a new version from changes" })).toBeInTheDocument();
  });

  it("shows Copy recipe button when editing", async () => {
    await create_and_edit("Banana Bread");
    expect(screen.getByRole("button", { name: "Copy recipe" })).toBeInTheDocument();
  });
});

describe("RecipeEditorPage — ingredients section", () => {
  it("shows the Ingredients section in the editor", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New recipe" }));
    expect(screen.getByRole("region", { name: "Ingredients" })).toBeInTheDocument();
  });
});

describe("RecipeEditorPage — sections editor", () => {
  it("shows the Instructions section in the editor", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New recipe" }));
    expect(screen.getByRole("region", { name: "Instructions" })).toBeInTheDocument();
  });

  it("shows Add section button", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New recipe" }));
    expect(screen.getByRole("button", { name: "Add section" })).toBeInTheDocument();
  });

  it("adds a section when Add section is clicked", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New recipe" }));
    await userEvent.click(screen.getByRole("button", { name: "Add section" }));
    expect(screen.getByRole("group", { name: /Section:/ })).toBeInTheDocument();
  });

  it("can add an instruction to a section", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New recipe" }));
    await userEvent.click(screen.getByRole("button", { name: "Add section" }));
    await userEvent.click(screen.getByRole("button", { name: "Add instruction to section" }));
    expect(screen.getByRole("textbox", { name: "Instruction text" })).toBeInTheDocument();
  });

  it("can add a text block to a section", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New recipe" }));
    await userEvent.click(screen.getByRole("button", { name: "Add section" }));
    await userEvent.click(screen.getByRole("button", { name: "Add text block to section" }));
    expect(screen.getByRole("textbox", { name: "Text block content" })).toBeInTheDocument();
  });

  it("can remove a section", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New recipe" }));
    await userEvent.click(screen.getByRole("button", { name: "Add section" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove section" }));
    expect(screen.queryByRole("group", { name: /Section:/ })).not.toBeInTheDocument();
  });
});

describe("RecipeEditorPage — copy recipe", () => {
  it("opens the copy dialog when Copy recipe is clicked", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New recipe" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Recipe title" }), "Soup");
    await userEvent.click(screen.getByRole("button", { name: "Save recipe" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit recipe: Soup" }));
    await userEvent.click(screen.getByRole("button", { name: "Copy recipe" }));
    expect(screen.getByRole("dialog", { name: "Copy recipe" })).toBeInTheDocument();
  });

  it("copy dialog pre-fills the title", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New recipe" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Recipe title" }), "Soup");
    await userEvent.click(screen.getByRole("button", { name: "Save recipe" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit recipe: Soup" }));
    await userEvent.click(screen.getByRole("button", { name: "Copy recipe" }));
    const dialog = screen.getByRole("dialog", { name: "Copy recipe" });
    expect(within(dialog).getByRole("textbox", { name: "New recipe title" })).toHaveValue("Soup (copy)");
  });

  it("cancel closes the copy dialog", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New recipe" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Recipe title" }), "Soup");
    await userEvent.click(screen.getByRole("button", { name: "Save recipe" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit recipe: Soup" }));
    await userEvent.click(screen.getByRole("button", { name: "Copy recipe" }));
    const dialog = screen.getByRole("dialog", { name: "Copy recipe" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Copy recipe" })).not.toBeInTheDocument();
  });
});
