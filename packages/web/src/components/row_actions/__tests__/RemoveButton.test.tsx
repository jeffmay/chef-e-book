import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RemoveButton } from "../RemoveButton.tsx";

describe("RemoveButton", () => {
  it("renders the ✕ glyph named by its label", () => {
    render(<RemoveButton label="Remove container Bowl" onClick={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Remove container Bowl" })).toHaveTextContent("✕");
  });

  it("calls its handler when pressed", async () => {
    const onClick = vi.fn();
    render(<RemoveButton label="Remove container Bowl" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove container Bowl" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
