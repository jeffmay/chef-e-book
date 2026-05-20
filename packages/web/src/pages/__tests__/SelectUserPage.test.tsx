import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { SelectUserPage } from "../select_user_page.js";

describe("SelectUserPage", () => {
  it("renders the title, subtitle, and form", () => {
    render(<SelectUserPage onSelect={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Recipe Book" })).toBeInTheDocument();
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get Started" })).toBeInTheDocument();
  });

  it("submit button is disabled when name is empty", () => {
    render(<SelectUserPage onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Get Started" })).toBeDisabled();
  });

  it("submit button is enabled after typing a name", async () => {
    render(<SelectUserPage onSelect={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Your name"), "Alice");
    expect(screen.getByRole("button", { name: "Get Started" })).toBeEnabled();
  });

  it("calls onSelect with trimmed name on submit", async () => {
    const onSelect = vi.fn();
    render(<SelectUserPage onSelect={onSelect} />);
    await userEvent.type(screen.getByLabelText("Your name"), "  Alice  ");
    await userEvent.click(screen.getByRole("button", { name: "Get Started" }));
    expect(onSelect).toHaveBeenCalledWith("Alice");
  });

  it("does not call onSelect when name is only whitespace", async () => {
    const onSelect = vi.fn();
    render(<SelectUserPage onSelect={onSelect} />);
    await userEvent.type(screen.getByLabelText("Your name"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Get Started" }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
