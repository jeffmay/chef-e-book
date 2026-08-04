import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RowActions } from "../RowActions.tsx";

describe("RowActions", () => {
  it("renders edit before remove", () => {
    render(
      <RowActions
        removeLabel="Remove thing"
        onRemove={vi.fn()}
        editLabel="Edit thing"
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["✎", "✕"]);
  });

  it("names each button from its prop", () => {
    render(
      <RowActions
        removeLabel="Remove thing"
        onRemove={vi.fn()}
        editLabel="Edit thing"
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Edit thing" })).toHaveTextContent("✎");
    expect(screen.getByRole("button", { name: "Remove thing" })).toHaveTextContent("✕");
  });

  it("omits the edit button when no edit handler is given", () => {
    render(<RowActions removeLabel="Remove thing" onRemove={vi.fn()} />);

    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["✕"]);
  });

  it("calls only the pressed handler", async () => {
    const onEdit = vi.fn();
    const onRemove = vi.fn();
    render(
      <RowActions
        removeLabel="Remove thing"
        onRemove={onRemove}
        editLabel="Edit thing"
        onEdit={onEdit}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Edit thing" }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("calls the remove handler from ✕", async () => {
    const onRemove = vi.fn();
    render(<RowActions removeLabel="Remove thing" onRemove={onRemove} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove thing" }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
