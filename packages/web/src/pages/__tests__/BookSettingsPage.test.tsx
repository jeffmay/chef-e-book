import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { BookSettingsPage } from "../BookSettingsPage.tsx";

function renderPage(bookName = "Alice") {
  const onRename = vi.fn();
  const onDelete = vi.fn();
  const view = render(
    <BookSettingsPage bookName={bookName} onRename={onRename} onDelete={onDelete} />,
  );
  return { onRename, onDelete, ...view };
}

describe("BookSettingsPage — renaming", () => {
  it("shows the current name in the name field", () => {
    renderPage();
    expect(screen.getByLabelText(/Book name/)).toHaveValue("Alice");
  });

  it("renames to the trimmed new name on ✔︎", async () => {
    const { onRename } = renderPage();
    const input = screen.getByLabelText(/Book name/);
    await userEvent.clear(input);
    await userEvent.type(input, "  Robert  ");
    await userEvent.click(screen.getByRole("button", { name: "Accept the new book name" }));
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename).toHaveBeenCalledWith("Robert");
  });

  it("renames on Enter", async () => {
    const { onRename } = renderPage();
    const input = screen.getByLabelText(/Book name/);
    await userEvent.clear(input);
    await userEvent.type(input, "Robert{Enter}");
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename).toHaveBeenCalledWith("Robert");
  });

  it("does not rename when the name is unchanged", async () => {
    const { onRename } = renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Accept the new book name" }));
    expect(onRename).not.toHaveBeenCalled();
  });

  it("refuses a blank name and says so", async () => {
    const { onRename } = renderPage();
    const input = screen.getByLabelText(/Book name/);
    await userEvent.clear(input);
    await userEvent.type(input, "   ");
    await userEvent.click(screen.getByRole("button", { name: "Accept the new book name" }));
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("The book needs a name.");
    expect(input).toHaveClass("field-input--error");
  });

  it("clears the blank-name error once the user types again", async () => {
    renderPage();
    const input = screen.getByLabelText(/Book name/);
    await userEvent.clear(input);
    await userEvent.click(screen.getByRole("button", { name: "Accept the new book name" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await userEvent.type(input, "B");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reverts the field on ↩", async () => {
    const { onRename } = renderPage();
    const input = screen.getByLabelText(/Book name/);
    await userEvent.clear(input);
    await userEvent.type(input, "Robert");
    await userEvent.click(screen.getByRole("button", { name: "Cancel renaming the book" }));
    expect(input).toHaveValue("Alice");
    expect(onRename).not.toHaveBeenCalled();
  });

  it("reverts the field on Escape", async () => {
    const { onRename } = renderPage();
    const input = screen.getByLabelText(/Book name/);
    await userEvent.type(input, "x{Escape}");
    expect(input).toHaveValue("Alice");
    expect(onRename).not.toHaveBeenCalled();
  });

  it("follows a rename made elsewhere while nothing is being edited", () => {
    const { rerender, onRename, onDelete } = renderPage();
    rerender(<BookSettingsPage bookName="Carol" onRename={onRename} onDelete={onDelete} />);
    expect(screen.getByLabelText(/Book name/)).toHaveValue("Carol");
  });
});

describe("BookSettingsPage — deleting", () => {
  it("asks for confirmation before deleting, explaining the consequences", async () => {
    const { onDelete } = renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Delete this book" }));
    expect(screen.getByRole("dialog", { name: 'Delete "Alice"?' })).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone on this device/)).toBeInTheDocument();
    expect(
      screen.getByText(/not be deleted automatically from your other devices/),
    ).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("deletes only after the Delete book confirmation", async () => {
    const { onDelete } = renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Delete this book" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete book" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the book when cancelled", async () => {
    const { onDelete } = renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Delete this book" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the book on Escape", async () => {
    const { onDelete } = renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Delete this book" }));
    await userEvent.keyboard("{Escape}");
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
