import { fixedId, RecipeBookId } from "@recipe-book/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import type { BookRegistryEntry } from "../../storage/bookRegistry.ts";
import { SelectBookPage } from "../SelectBookPage.tsx";

const ALICE_ID = fixedId(RecipeBookId, "alice");
const BOB_ID = fixedId(RecipeBookId, "bob");

function entry(id: RecipeBookId, name: string): BookRegistryEntry {
  return { id, name, created_at: 1, last_opened_at: 1 };
}

const ALICE = entry(ALICE_ID, "Alice");
const BOB = entry(BOB_ID, "Bob");

function renderPage(
  props: {
    books?: BookRegistryEntry[];
    onOpen?: (id: RecipeBookId) => void;
    onCreate?: (name: string) => void;
    onRename?: (id: RecipeBookId, name: string) => void;
    onDelete?: (id: RecipeBookId) => void;
    error?: string | null;
  } = {},
) {
  const handlers = {
    onOpen: props.onOpen ?? vi.fn(),
    onCreate: props.onCreate ?? vi.fn(),
    onRename: props.onRename ?? vi.fn(),
    onDelete: props.onDelete ?? vi.fn(),
  };
  render(<SelectBookPage books={props.books ?? []} error={props.error ?? null} {...handlers} />);
  return handlers;
}

describe("SelectBookPage — creating a book", () => {
  it("renders the title, subtitle, and form", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Recipe Book" })).toBeInTheDocument();
    expect(screen.getByLabelText("Book name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create book" })).toBeInTheDocument();
  });

  it("shows no book list when the device has no books", () => {
    renderPage();
    expect(screen.queryByRole("heading", { name: "Your books" })).not.toBeInTheDocument();
  });

  it("submit button is disabled when name is empty", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "Create book" })).toBeDisabled();
  });

  it("submit button is enabled after typing a name", async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText("Book name"), "Alice");
    expect(screen.getByRole("button", { name: "Create book" })).toBeEnabled();
  });

  it("calls onCreate with the trimmed name on submit", async () => {
    const { onCreate } = renderPage();
    await userEvent.type(screen.getByLabelText("Book name"), "  Alice  ");
    await userEvent.click(screen.getByRole("button", { name: "Create book" }));
    expect(onCreate).toHaveBeenCalledWith("Alice");
  });

  it("does not call onCreate when the name is only whitespace", async () => {
    const { onCreate } = renderPage();
    await userEvent.type(screen.getByLabelText("Book name"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Create book" }));
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("still offers to create a book when others exist", async () => {
    const { onCreate } = renderPage({ books: [ALICE] });
    await userEvent.type(screen.getByLabelText("Book name"), "Carol");
    await userEvent.click(screen.getByRole("button", { name: "Create book" }));
    expect(onCreate).toHaveBeenCalledWith("Carol");
  });
});

describe("SelectBookPage — books on this device", () => {
  it("lists every book, in the order given", () => {
    renderPage({ books: [BOB, ALICE] });
    expect(screen.getByRole("heading", { name: "Your books" })).toBeInTheDocument();
    const open = screen.getAllByRole("button", { name: /^Open book / });
    expect(open.map((b) => b.textContent)).toEqual(["Bob", "Alice"]);
  });

  it("opens the book that was clicked", async () => {
    const { onOpen } = renderPage({ books: [ALICE, BOB] });
    await userEvent.click(screen.getByRole("button", { name: "Open book Bob" }));
    expect(onOpen).toHaveBeenCalledWith(BOB_ID);
  });
});

describe("SelectBookPage — renaming a book", () => {
  async function startRename(name: string) {
    await userEvent.click(screen.getByRole("button", { name: `Rename book ${name}` }));
  }

  it("opens an editor holding the current name, focused", async () => {
    renderPage({ books: [ALICE] });
    await startRename("Alice");
    const input = screen.getByLabelText("New name for Alice");
    expect(input).toHaveValue("Alice");
    expect(input).toHaveFocus();
  });

  it("renames on ✔︎ with the trimmed name", async () => {
    const { onRename } = renderPage({ books: [ALICE, BOB] });
    await startRename("Alice");
    const input = screen.getByLabelText("New name for Alice");
    await userEvent.clear(input);
    await userEvent.type(input, "  Alicia  ");
    await userEvent.click(screen.getByRole("button", { name: "Accept new name for Alice" }));
    expect(onRename).toHaveBeenCalledWith(ALICE_ID, "Alicia");
    expect(screen.queryByLabelText("New name for Alice")).not.toBeInTheDocument();
  });

  it("renames on Enter", async () => {
    const { onRename } = renderPage({ books: [ALICE] });
    await startRename("Alice");
    await userEvent.type(screen.getByLabelText("New name for Alice"), "{Backspace}a{Enter}");
    expect(onRename).toHaveBeenCalledWith(ALICE_ID, "Alica");
  });

  it("cancels on ↩ without renaming", async () => {
    const { onRename } = renderPage({ books: [ALICE] });
    await startRename("Alice");
    await userEvent.type(screen.getByLabelText("New name for Alice"), "zzz");
    await userEvent.click(screen.getByRole("button", { name: "Cancel renaming Alice" }));
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Open book Alice" })).toBeInTheDocument();
  });

  it("cancels on Escape without renaming", async () => {
    const { onRename } = renderPage({ books: [ALICE] });
    await startRename("Alice");
    await userEvent.type(screen.getByLabelText("New name for Alice"), "zzz{Escape}");
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Open book Alice" })).toBeInTheDocument();
  });

  it("does not rename when the name is unchanged or blank", async () => {
    const { onRename } = renderPage({ books: [ALICE] });
    await startRename("Alice");
    await userEvent.click(screen.getByRole("button", { name: "Accept new name for Alice" }));
    await startRename("Alice");
    await userEvent.clear(screen.getByLabelText("New name for Alice"));
    await userEvent.click(screen.getByRole("button", { name: "Accept new name for Alice" }));
    expect(onRename).not.toHaveBeenCalled();
  });
});

describe("SelectBookPage — deleting a book", () => {
  async function askToDelete(name: string) {
    await userEvent.click(screen.getByRole("button", { name: `Delete book ${name}` }));
  }

  it("asks for confirmation naming the book, and does not delete yet", async () => {
    const { onDelete } = renderPage({ books: [ALICE] });
    await askToDelete("Alice");
    expect(screen.getByRole("dialog", { name: 'Delete "Alice"?' })).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("deletes only after the confirmation button", async () => {
    const { onDelete } = renderPage({ books: [ALICE, BOB] });
    await askToDelete("Bob");
    await userEvent.click(screen.getByRole("button", { name: "Delete book" }));
    expect(onDelete).toHaveBeenCalledWith(BOB_ID);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the book when cancelled", async () => {
    const { onDelete } = renderPage({ books: [ALICE] });
    await askToDelete("Alice");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the book on Escape", async () => {
    const { onDelete } = renderPage({ books: [ALICE] });
    await askToDelete("Alice");
    await userEvent.keyboard("{Escape}");
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("makes Enter the safe choice: it cancels instead of deleting", async () => {
    const { onDelete } = renderPage({ books: [ALICE] });
    await askToDelete("Alice");
    await userEvent.keyboard("{Enter}");
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("SelectBookPage — when a rename or delete fails", () => {
  it("shows why a rename failed, instead of dropping the error", async () => {
    const onRename = vi.fn().mockRejectedValue(new Error("storage is blocked"));
    renderPage({ books: [ALICE], onRename });
    await userEvent.click(screen.getByRole("button", { name: "Rename book Alice" }));
    await userEvent.type(screen.getByLabelText("New name for Alice"), "x{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      'Could not rename "Alice": storage is blocked',
    );
  });

  it("shows why a delete failed", async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error("still open in another tab"));
    renderPage({ books: [ALICE], onDelete });
    await userEvent.click(screen.getByRole("button", { name: "Delete book Alice" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete book" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      'Could not delete "Alice": still open in another tab',
    );
  });

  it("clears the message when the next action is tried", async () => {
    const onRename = vi
      .fn()
      .mockRejectedValueOnce(new Error("blocked"))
      .mockResolvedValue(undefined);
    renderPage({ books: [ALICE], onRename });
    await userEvent.click(screen.getByRole("button", { name: "Rename book Alice" }));
    await userEvent.type(screen.getByLabelText("New name for Alice"), "x{Enter}");
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Rename book Alice" }));
    await userEvent.type(screen.getByLabelText("New name for Alice"), "y{Enter}");
    await vi.waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});

describe("SelectBookPage — an error from before the picker showed", () => {
  it("shows the error it is given", () => {
    renderPage({ books: [ALICE], error: "Could not delete the book: still open in another tab" });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not delete the book: still open in another tab",
    );
  });

  it("shows no alert when there is no error", () => {
    renderPage({ books: [ALICE] });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
