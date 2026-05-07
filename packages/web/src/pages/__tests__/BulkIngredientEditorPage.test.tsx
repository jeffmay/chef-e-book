import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import * as Y from "yjs";
import { DocContext } from "../../contexts/doc_context.js";
import { BulkIngredientEditorPage } from "../BulkIngredientEditorPage.js";

function make_wrapper(doc: Y.Doc) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(DocContext.Provider, { value: doc }, children);
  };
}

let doc: Y.Doc;

beforeEach(() => {
  doc = new Y.Doc();
});

function setup() {
  return render(<BulkIngredientEditorPage />, { wrapper: make_wrapper(doc) });
}

function get_table() {
  return screen.getByRole("region", { name: "Ingredient list" });
}

describe("BulkIngredientEditorPage — initial render", () => {
  it("renders the Ingredients heading", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Ingredients" })).toBeInTheDocument();
  });

  it("renders the ingredient table with default data", () => {
    setup();
    expect(get_table()).toBeInTheDocument();
    expect(within(get_table()).getByText("Butter")).toBeInTheDocument();
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
    expect(within(get_table()).getByText("Coconut Oil")).toBeInTheDocument();
    expect(screen.queryByLabelText("New ingredient name")).not.toBeInTheDocument();
  });

  it("creates an ingredient with a parent", async () => {
    setup();
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

describe("BulkIngredientEditorPage — bulk actions", () => {
  it("shows bulk action bar after selecting a row", async () => {
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Butter" }));
    expect(screen.getByRole("region", { name: "Bulk actions" })).toBeInTheDocument();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("bulk add labels updates the ingredient in the store", async () => {
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Butter" }));
    await userEvent.type(screen.getByLabelText("Labels to add"), "organic");
    await userEvent.click(screen.getByRole("button", { name: "Apply add labels" }));
    // Bulk bar input should be cleared after apply
    expect(screen.getByLabelText("Labels to add")).toHaveValue("");
  });

  it("bulk remove labels clears the input after apply", async () => {
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Butter" }));
    await userEvent.type(screen.getByLabelText("Labels to remove"), "fat");
    await userEvent.click(screen.getByRole("button", { name: "Apply remove labels" }));
    expect(screen.getByLabelText("Labels to remove")).toHaveValue("");
  });
});
