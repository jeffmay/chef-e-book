import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "../Modal.tsx";

function setup(overrides?: {
  readonly onClose?: () => boolean;
  readonly onEnterClickId?: "save" | "discard";
  readonly saveDisabled?: boolean;
}) {
  const onSave = vi.fn();
  const onDiscard = vi.fn();
  const onClose = overrides?.onClose ?? vi.fn(() => true);
  render(
    <Modal
      title="Unsaved changes"
      buttons={{
        save: {
          text: "Save",
          dangerous: false,
          onClick: onSave,
          ...(overrides?.saveDisabled === true ? { disabled: true } : {}),
        },
        discard: { text: "Discard", dangerous: true, onClick: onDiscard },
      }}
      onEnterClickId={overrides?.onEnterClickId ?? "save"}
      onClose={onClose}
    >
      <p>Body text</p>
      <input aria-label="Name" />
      <textarea aria-label="Notes" />
    </Modal>,
  );
  return { onSave, onDiscard, onClose };
}

describe("Modal", () => {
  it("names the dialog after its title", () => {
    setup();

    expect(screen.getByRole("dialog", { name: "Unsaved changes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Unsaved changes" })).toBeInTheDocument();
  });

  it("prefers an explicit ariaLabel over the title", () => {
    render(
      <Modal
        title="Delete 2 recipes?"
        ariaLabel="Confirm delete recipes"
        buttons={{ ok: { text: "OK", dangerous: false, onClick: vi.fn() } }}
        onClose={() => true}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Confirm delete recipes" })).toBeInTheDocument();
  });

  it("renders one button per config entry, in insertion order", () => {
    setup();

    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Save", "Discard"]);
  });

  it("marks only the dangerous button", () => {
    setup();

    expect(screen.getByRole("button", { name: "Discard" })).toHaveClass("modal-button--dangerous");
    expect(screen.getByRole("button", { name: "Save" })).not.toHaveClass("modal-button--dangerous");
  });

  it("runs a button's onClick when it is pressed", async () => {
    const { onSave, onDiscard } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("asks onClose on Escape", async () => {
    const { onClose, onSave } = setup();
    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("asks onClose on Escape from inside a field", async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByLabelText("Name"));
    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("returns focus to the modal when onClose refuses", async () => {
    const onClose = vi.fn(() => false);
    setup({ onClose });
    await userEvent.click(screen.getByLabelText("Name"));
    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toHaveFocus();
  });

  it("asks onClose when the backdrop is clicked", async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByTestId("modal-overlay"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores clicks inside the card", async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByText("Body text"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("clicks onEnterClickId on Enter", async () => {
    const { onSave, onDiscard } = setup();
    await userEvent.click(screen.getByLabelText("Name"));
    await userEvent.keyboard("{Enter}");

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it("clicks whichever button onEnterClickId names", async () => {
    const { onSave, onDiscard } = setup({ onEnterClickId: "discard" });
    await userEvent.click(screen.getByLabelText("Name"));
    await userEvent.keyboard("{Enter}");

    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("leaves Enter to a textarea, which takes it as a newline", async () => {
    const { onSave } = setup();
    await userEvent.click(screen.getByLabelText("Notes"));
    await userEvent.keyboard("a{Enter}b");

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Notes")).toHaveValue("a\nb");
  });

  it("does not confirm through a disabled button", async () => {
    const { onSave } = setup({ saveDisabled: true });
    await userEvent.click(screen.getByLabelText("Name"));
    await userEvent.keyboard("{Enter}");

    expect(onSave).not.toHaveBeenCalled();
  });

  it("does nothing on Enter without an onEnterClickId", async () => {
    const onOk = vi.fn();
    render(
      <Modal
        title="No default"
        buttons={{ ok: { text: "OK", dangerous: false, onClick: onOk } }}
        onClose={() => true}
      >
        <input aria-label="Name" />
      </Modal>,
    );
    await userEvent.click(screen.getByLabelText("Name"));
    await userEvent.keyboard("{Enter}");

    expect(onOk).not.toHaveBeenCalled();
  });

  it("focuses the card on mount, so Escape works before tabbing in", () => {
    setup();

    expect(screen.getByRole("dialog")).toHaveFocus();
  });
});
