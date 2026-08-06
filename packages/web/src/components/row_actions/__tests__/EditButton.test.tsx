import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EditButton } from "../EditButton.tsx";

describe("EditButton", () => {
  it("renders the ✎ glyph named by its label", () => {
    render(<EditButton label="Edit container: Bowl" onClick={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Edit container: Bowl" })).toHaveTextContent("✎");
  });

  it("calls its handler when pressed", async () => {
    const onClick = vi.fn();
    render(<EditButton label="Edit container: Bowl" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit container: Bowl" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
