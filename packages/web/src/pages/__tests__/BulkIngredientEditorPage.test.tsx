import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import * as Y from "yjs";
import { DocContext } from "../../contexts/doc_context.js";
import { BulkIngredientEditorPage } from "../bulk_ingredient_editor_page.js";

const MOCK_CSV = `Unique ID,Type,Description,Default Measurement Type,Labels
------butter,ingredient,Butter,volume,fat+solid
------cheese,ingredient,Cheese,weight,solid
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
  it("renders the Ingredients heading", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Ingredients" })).toBeInTheDocument();
  });

  it("renders the ingredient table with default data", async () => {
    await setupAndWait();
    expect(getTable()).toBeInTheDocument();
    expect(within(getTable()).getByText("Butter")).toBeInTheDocument();
  });

  it("shows the + New ingredient button", () => {
    setup();
    expect(screen.getByLabelText("Add new ingredient")).toBeInTheDocument();
  });

  it("does not show filter bar", () => {
    setup();
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
  const butter_cell = screen.getByText("Butter");
  const butter_row = butter_cell.closest("tr")!;
  const checkbox = within(butter_row).getAllByRole("checkbox")[0]!;
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
    await userEvent.type(screen.getByRole("combobox", { name: "Labels to add" }), "organic");
    await userEvent.click(await screen.findByText(/Create "organic"/));
    await userEvent.click(screen.getByRole("button", { name: "Apply add labels" }));
    expect(screen.getByRole("combobox", { name: "Labels to add" })).toHaveValue("");
  });

  it("bulk remove labels clears the selection after apply", async () => {
    await selectButterRow();
    // "fat" already exists as a label — select it from the dropdown (no Create needed)
    await userEvent.click(screen.getByRole("combobox", { name: "Labels to remove" }));
    await userEvent.click(await screen.findByRole("option", { name: "fat" }));
    await userEvent.click(screen.getByRole("button", { name: "Apply remove labels" }));
    expect(screen.getByRole("combobox", { name: "Labels to remove" })).toHaveValue("");
  });
});
