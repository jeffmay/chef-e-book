import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { SelectBookPage } from "../SelectBookPage.js";

describe("SelectBookPage", () => {
  it("renders the title, subtitle, and form", () => {
    render(<SelectBookPage onSelect={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Recipe Book" })).toBeInTheDocument();
    expect(screen.getByLabelText("Book name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get Started" })).toBeInTheDocument();
  });

  it("submit button is disabled when name is empty", () => {
    render(<SelectBookPage onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Get Started" })).toBeDisabled();
  });

  it("submit button is enabled after typing a name", async () => {
    render(<SelectBookPage onSelect={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Book name"), "Alice");
    expect(screen.getByRole("button", { name: "Get Started" })).toBeEnabled();
  });

  it("calls onSelect with trimmed name on submit", async () => {
    const onSelect = vi.fn();
    render(<SelectBookPage onSelect={onSelect} />);
    await userEvent.type(screen.getByLabelText("Book name"), "  Alice  ");
    await userEvent.click(screen.getByRole("button", { name: "Get Started" }));
    expect(onSelect).toHaveBeenCalledWith("Alice");
  });

  it("does not call onSelect when name is only whitespace", async () => {
    const onSelect = vi.fn();
    render(<SelectBookPage onSelect={onSelect} />);
    await userEvent.type(screen.getByLabelText("Book name"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Get Started" }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
