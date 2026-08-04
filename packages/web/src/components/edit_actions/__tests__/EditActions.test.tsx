import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EditActions } from "../EditActions.tsx";

function setup() {
  const onCancel = vi.fn();
  const onAccept = vi.fn();
  render(
    <EditActions
      cancelLabel="Cancel changes to thing"
      acceptLabel="Accept changes to thing"
      onCancel={onCancel}
      onAccept={onAccept}
    />,
  );
  return { onCancel, onAccept };
}

describe("EditActions", () => {
  it("renders cancel before accept", () => {
    setup();

    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["↩", "✔︎"]);
  });

  it("names each button from its prop", () => {
    setup();

    expect(screen.getByRole("button", { name: "Cancel changes to thing" })).toHaveTextContent("↩");
    expect(screen.getByRole("button", { name: "Accept changes to thing" })).toHaveTextContent("✔︎");
  });

  it("calls only the pressed handler", async () => {
    const { onCancel, onAccept } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Accept changes to thing" }));

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("calls the cancel handler from ↩", async () => {
    const { onCancel, onAccept } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Cancel changes to thing" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("appends a caller's class to the wrapper", () => {
    render(
      <EditActions
        className="re-item-editor-actions"
        cancelLabel="Cancel"
        acceptLabel="Accept"
        onCancel={vi.fn()}
        onAccept={vi.fn()}
      />,
    );

    const wrapper = screen.getByRole("button", { name: "Accept" }).parentElement;
    expect(wrapper).toHaveClass("edit-actions", "re-item-editor-actions");
  });
});
