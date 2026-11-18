import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { BookDocContext } from "../../contexts/docContext.ts";
import { flushAsyncEffects, seedKitchenwareFromCsv } from "../../testUtils.ts";
import { BulkIngredientEditorPage } from "../BulkIngredientEditorPage.tsx";

const MOCK_CSV = `Unique ID,Type,Description,Default Measurement Type,Labels
------butter,ingredient,Butter,volume,fat+solid
------cheese,ingredient,Cheese,weight,solid
`;

function makeWrapper(doc: Y.Doc) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      BookDocContext.Provider,
      { value: { doc, whenSynced: Promise.resolve() } },
      children,
    );
  };
}

let doc: Y.Doc;

beforeEach(() => {
  doc = new Y.Doc();
  seedKitchenwareFromCsv(doc, MOCK_CSV);
});

function setup() {
  return render(<BulkIngredientEditorPage />, { wrapper: makeWrapper(doc) });
}

async function setupAndWait() {
  setup();
  // Wait for the async CSV fetch and Yjs observer to populate the table
  await screen.findByText("Butter");
}

function getTable() {
  return screen.getByRole("region", { name: "Ingredient list" });
}

describe("BulkIngredientEditorPage — initial render", () => {
  it("renders the Ingredients heading", async () => {
    setup();
    await flushAsyncEffects();
    expect(screen.getByRole("heading", { name: "Ingredients" })).toBeInTheDocument();
  });

  it("renders the ingredient table with default data", async () => {
    await setupAndWait();
    expect(getTable()).toBeInTheDocument();
    expect(within(getTable()).getByText("Butter")).toBeInTheDocument();
  });

  it("shows the + New ingredient button", async () => {
    setup();
    await flushAsyncEffects();
    expect(screen.getByLabelText("Add new ingredient")).toBeInTheDocument();
  });

  it("does not show filter bar", async () => {
    setup();
    await flushAsyncEffects();
    expect(screen.queryByLabelText("Filter ingredients")).not.toBeInTheDocument();
  });
});

describe("BulkIngredientEditorPage — add ingredient form", () => {
  it("shows the add form when + New ingredient is clicked", async () => {
    setup();
    await userEvent.click(screen.getByLabelText("Add new ingredient"));
    expect(screen.getByLabelText("New ingredient name")).toBeInTheDocument();
  });

  it("hides the add form on Cancel", async () => {
    setup();
    await userEvent.click(screen.getByLabelText("Add new ingredient"));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("New ingredient name")).not.toBeInTheDocument();
  });

  it("Add button is disabled when name is empty", async () => {
    setup();
    await userEvent.click(screen.getByLabelText("Add new ingredient"));
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("creates an ingredient and closes the form", async () => {
    setup();
    await userEvent.click(screen.getByLabelText("Add new ingredient"));
    await userEvent.type(screen.getByLabelText("New ingredient name"), "Coconut Oil");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(within(getTable()).getByText("Coconut Oil")).toBeInTheDocument();
    expect(screen.queryByLabelText("New ingredient name")).not.toBeInTheDocument();
  });

  it("creates an ingredient with labels using LabelEditor", async () => {
    setup();
    await userEvent.click(screen.getByLabelText("Add new ingredient"));
    await userEvent.type(screen.getByLabelText("New ingredient name"), "Olive Oil");
    await userEvent.type(screen.getByRole("combobox", { name: "New ingredient labels" }), "oil");
    await userEvent.click(await screen.findByText(/Create "oil"/));
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(within(getTable()).getByText("Olive Oil")).toBeInTheDocument();
    expect(screen.queryByLabelText("New ingredient name")).not.toBeInTheDocument();
  });

  it("creates an ingredient with a parent", async () => {
    await setupAndWait();
    await userEvent.click(screen.getByLabelText("Add new ingredient"));
    await userEvent.type(screen.getByLabelText("New ingredient name"), "Salted Butter");
    await userEvent.selectOptions(
      screen.getByLabelText("New ingredient parent"),
      screen.getAllByRole("option", { name: "Butter" })[0]!,
    );
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.queryByLabelText("New ingredient name")).not.toBeInTheDocument();
  });
});

async function selectButterRow() {
  await setupAndWait();
  // Find the row containing "Butter" and click its checkbox
  const butterCell = screen.getByText("Butter");
  const butterRow = butterCell.closest("tr")!;
  const checkbox = within(butterRow).getAllByRole("checkbox")[0]!;
  await userEvent.click(checkbox);
}

describe("BulkIngredientEditorPage — bulk actions", () => {
  it("shows bulk action bar after selecting a row", async () => {
    await selectButterRow();
    expect(screen.getByRole("region", { name: "Bulk actions" })).toBeInTheDocument();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("bulk add labels clears the selection after apply", async () => {
    await selectButterRow();
    await userEvent.click(screen.getByRole("button", { name: "Show labels to add" }));
    await userEvent.type(screen.getByRole("combobox", { name: "Labels to add" }), "organic");
    await userEvent.click(await screen.findByText(/Create "organic"/));
    await userEvent.click(screen.getByRole("button", { name: "Apply add labels" }));
    expect(screen.getByRole("combobox", { name: "Labels to add" })).toHaveValue("");
  });

  it("bulk remove labels clears the selection after apply", async () => {
    await selectButterRow();
    await userEvent.click(screen.getByRole("button", { name: "Show labels to remove" }));
    // "fat" already exists as a label — select it from the dropdown (no Create needed)
    await userEvent.click(screen.getByRole("combobox", { name: "Labels to remove" }));
    await userEvent.click(await screen.findByRole("option", { name: "fat" }));
    await userEvent.click(screen.getByRole("button", { name: "Apply remove labels" }));
    expect(screen.getByRole("combobox", { name: "Labels to remove" })).toHaveValue("");
  });
});

describe("BulkIngredientEditorPage — name uniqueness", () => {
  async function openAddForm() {
    await setupAndWait();
    await userEvent.click(screen.getByLabelText("Add new ingredient"));
    return screen.getByLabelText("New ingredient name");
  }

  it("shows no message for a free name, and lets it be added", async () => {
    const input = await openAddForm();
    await userEvent.type(input, "Oregano");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
  });

  it("refuses a name another ingredient holds, whatever its case or number", async () => {
    const input = await openAddForm();
    await userEvent.type(input, "  BUTTERS ");
    expect(screen.getByRole("alert")).toHaveTextContent(
      'An ingredient named "Butter" already exists',
    );
    expect(input).toBeInvalid();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("does not add the ingredient on Enter while the name is taken", async () => {
    const input = await openAddForm();
    await userEvent.type(input, "Cheese{Enter}");
    expect(within(getTable()).getAllByText("Cheese")).toHaveLength(1);
    expect(screen.getByLabelText("New ingredient name")).toBeInTheDocument();
  });

  it("clears the message once the name is changed to a free one", async () => {
    const input = await openAddForm();
    await userEvent.type(input, "Butter");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await userEvent.type(input, " Cookies");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
  });

  it("refuses to rename an ingredient in the table to a name another holds", async () => {
    await setupAndWait();
    await userEvent.dblClick(screen.getByRole("button", { name: "Edit name for Cheese" }));
    const input = screen.getByRole("textbox", { name: "Edit name for Cheese" });
    await userEvent.clear(input);
    await userEvent.type(input, "butters{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent(
      'An ingredient named "Butter" already exists',
    );
    expect(screen.getByRole("textbox", { name: "Edit name for Cheese" })).toBeInTheDocument();
  });

  it("lets an ingredient be renamed to another spelling of its own name", async () => {
    await setupAndWait();
    await userEvent.dblClick(screen.getByRole("button", { name: "Edit name for Cheese" }));
    const input = screen.getByRole("textbox", { name: "Edit name for Cheese" });
    await userEvent.clear(input);
    await userEvent.type(input, "Cheeses{Enter}");
    expect(
      await screen.findByRole("button", { name: "Edit name for Cheeses" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
