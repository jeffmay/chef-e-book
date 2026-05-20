import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { NavMenu } from "../nav_menu.js";

describe("NavMenu", () => {
  it("renders the trigger button", () => {
    render(<NavMenu onNavigate={vi.fn()} />);
    expect(screen.getByLabelText("Navigation menu")).toBeInTheDocument();
  });

  it("shows Ingredients link when opened", async () => {
    render(<NavMenu onNavigate={vi.fn()} />);
    await userEvent.click(screen.getByLabelText("Navigation menu"));
    expect(screen.getByRole("button", { name: "Ingredients" })).toBeInTheDocument();
  });

  it("calls onNavigate with bulk_ingredient_editor when Ingredients clicked", async () => {
    const onNavigate = vi.fn();
    render(<NavMenu onNavigate={onNavigate} />);
    await userEvent.click(screen.getByLabelText("Navigation menu"));
    await userEvent.click(screen.getByRole("button", { name: "Ingredients" }));
    expect(onNavigate).toHaveBeenCalledWith("bulk_ingredient_editor");
  });
});
