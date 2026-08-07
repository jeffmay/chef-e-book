import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AcceptOrCancelEditor } from "../../accept_or_cancel_editor/AcceptOrCancelEditor.tsx";
import { EditActions } from "../EditActions.tsx";

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
      <EditActions />
    </AcceptOrCancelEditor>,
  );
  return { onCancel, onAccept };
}

describe("EditActions", () => {
  it("renders cancel before accept", () => {
    setup();

    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["↩", "✔︎"]);
  });

  it("names each button from the enclosing editor's labels", () => {
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

  it("keeps both buttons in one wrapper, so they wrap together", () => {
    setup();

    const wrapper = screen.getByRole("button", { name: "Accept changes to thing" }).parentElement;
    expect(wrapper).toHaveClass("edit-actions");
    expect(wrapper?.children).toHaveLength(2);
  });
});
