import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EditActions } from "../../edit_actions/EditActions.tsx";
import { AcceptOrCancelEditor, useAcceptOrCancel } from "../AcceptOrCancelEditor.tsx";

function setup() {
  const onCancel = vi.fn();
  const onAccept = vi.fn();
  render(
    <AcceptOrCancelEditor
      cancelLabel="Cancel changes to thing"
      acceptLabel="Accept changes to thing"
      onCancel={onCancel}
      onAccept={onAccept}
    >
      <input aria-label="Name" />
      <textarea aria-label="Notes" />
      <EditActions />
    </AcceptOrCancelEditor>,
  );
  return { onCancel, onAccept };
}

/** Two nested editors, to check that only the closest one answers a key. */
function setupNested() {
  const outer = { onCancel: vi.fn(), onAccept: vi.fn() };
  const inner = { onCancel: vi.fn(), onAccept: vi.fn() };
  render(
    <AcceptOrCancelEditor
      cancelLabel="Cancel outer"
      acceptLabel="Accept outer"
      onCancel={outer.onCancel}
      onAccept={outer.onAccept}
    >
      <input aria-label="Outer field" />
      <AcceptOrCancelEditor
        cancelLabel="Cancel inner"
        acceptLabel="Accept inner"
        onCancel={inner.onCancel}
        onAccept={inner.onAccept}
      >
        <input aria-label="Inner field" />
      </AcceptOrCancelEditor>
    </AcceptOrCancelEditor>,
  );
  return { outer, inner };
}

describe("AcceptOrCancelEditor", () => {
  it("cancels on Escape", async () => {
    const { onCancel, onAccept } = setup();
    await userEvent.click(screen.getByLabelText("Name"));
    await userEvent.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("accepts on Enter", async () => {
    const { onCancel, onAccept } = setup();
    await userEvent.click(screen.getByLabelText("Name"));
    await userEvent.keyboard("{Enter}");

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("leaves Enter to a textarea, which takes it as a newline", async () => {
    const { onAccept } = setup();
    await userEvent.click(screen.getByLabelText("Notes"));
    await userEvent.keyboard("a{Enter}b");

    expect(onAccept).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Notes")).toHaveValue("a\nb");
  });

  it("leaves Enter to a button, which takes it as its own press", async () => {
    const { onCancel, onAccept } = setup();
    screen.getByRole("button", { name: "Cancel changes to thing" }).focus();
    await userEvent.keyboard("{Enter}");

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("hands its labels and handlers to EditActions", async () => {
    const { onAccept } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Accept changes to thing" }));

    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("lays out its children as if the wrapper were not there", () => {
    setup();

    expect(screen.getByLabelText("Name").parentElement).toHaveClass("accept-or-cancel-editor");
  });

  it("takes extra classes alongside its own", () => {
    render(
      <AcceptOrCancelEditor
        cancelLabel="Cancel"
        acceptLabel="Accept"
        onCancel={vi.fn()}
        onAccept={vi.fn()}
        className="extra-class"
      >
        <input aria-label="Name" />
      </AcceptOrCancelEditor>,
    );

    const wrapper = screen.getByLabelText("Name").parentElement;
    expect(wrapper).toHaveClass("accept-or-cancel-editor");
    expect(wrapper).toHaveClass("extra-class");
  });

  describe("nested editors", () => {
    it("cancels only the closest editor", async () => {
      const { outer, inner } = setupNested();
      await userEvent.click(screen.getByLabelText("Inner field"));
      await userEvent.keyboard("{Escape}");

      expect(inner.onCancel).toHaveBeenCalledTimes(1);
      expect(outer.onCancel).not.toHaveBeenCalled();
    });

    it("accepts only the closest editor", async () => {
      const { outer, inner } = setupNested();
      await userEvent.click(screen.getByLabelText("Inner field"));
      await userEvent.keyboard("{Enter}");

      expect(inner.onAccept).toHaveBeenCalledTimes(1);
      expect(outer.onAccept).not.toHaveBeenCalled();
    });

    it("still answers keys outside the nested editor", async () => {
      const { outer, inner } = setupNested();
      await userEvent.click(screen.getByLabelText("Outer field"));
      await userEvent.keyboard("{Escape}");

      expect(outer.onCancel).toHaveBeenCalledTimes(1);
      expect(inner.onCancel).not.toHaveBeenCalled();
    });
  });

  describe("useAcceptOrCancel", () => {
    it("throws outside an editor rather than rendering dead buttons", () => {
      function Orphan() {
        useAcceptOrCancel();
        return null;
      }
      // React logs the error it re-throws; the assertion is on the throw itself.
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        expect(() => render(<Orphan />)).toThrow(/inside an <AcceptOrCancelEditor>/);
      } finally {
        consoleError.mockRestore();
      }
    });
  });
});
