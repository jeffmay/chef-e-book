import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DeleteBookModal } from "../DeleteBookModal.tsx";

function renderModal() {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(<DeleteBookModal bookName="Alice" onCancel={onCancel} onConfirm={onConfirm} />);
  return { onCancel, onConfirm };
}

describe("DeleteBookModal", () => {
  it("names the book in its title", () => {
    renderModal();
    expect(screen.getByRole("dialog", { name: 'Delete "Alice"?' })).toBeInTheDocument();
  });

  it("explains that it cannot be undone on this device", () => {
    renderModal();
    expect(screen.getByText(/cannot be undone on this device/)).toBeInTheDocument();
  });

  it("explains that it is not deleted automatically on other devices", () => {
    renderModal();
    expect(screen.getByText(/not be deleted automatically from your other devices/)).toBeVisible();
  });

  it("confirms only from the Delete book button", async () => {
    const { onConfirm, onCancel } = renderModal();
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Delete book" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("cancels from the Cancel button", async () => {
    const { onConfirm, onCancel } = renderModal();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("cancels on Escape", async () => {
    const { onConfirm, onCancel } = renderModal();
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("makes Enter the safe choice: it cancels instead of deleting", async () => {
    const { onConfirm, onCancel } = renderModal();
    await userEvent.keyboard("{Enter}");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
