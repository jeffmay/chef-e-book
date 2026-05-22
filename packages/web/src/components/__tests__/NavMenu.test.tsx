import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { type ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { NavMenu } from "../NavMenu.js";

function renderMenu(extraChildren?: ReactNode) {
  return render(
    <MemoryRouter>
      <NavMenu />
      {extraChildren}
    </MemoryRouter>,
  );
}

describe("NavMenu", () => {
  it("renders the navigation menu trigger", () => {
    renderMenu();
    expect(screen.getByLabelText("Navigation menu")).toBeInTheDocument();
  });

  it("shows Recipes and Ingredients links when opened", async () => {
    renderMenu();
    await userEvent.click(screen.getByLabelText("Navigation menu"));
    expect(screen.getByRole("link", { name: "Recipes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ingredients" })).toBeInTheDocument();
  });

  it("Recipes link points to /recipes", async () => {
    renderMenu();
    await userEvent.click(screen.getByLabelText("Navigation menu"));
    expect(screen.getByRole("link", { name: "Recipes" })).toHaveAttribute("href", "/recipes");
  });

  it("Ingredients link points to /ingredients", async () => {
    renderMenu();
    await userEvent.click(screen.getByLabelText("Navigation menu"));
    expect(screen.getByRole("link", { name: "Ingredients" })).toHaveAttribute(
      "href",
      "/ingredients",
    );
  });

  it("closes the menu when focus moves to an element outside the menu", async () => {
    renderMenu(<button>Outside</button>);
    const trigger = screen.getByLabelText("Navigation menu");
    await userEvent.click(trigger);
    const details = trigger.closest("details");
    expect(details?.hasAttribute("open")).toBe(true);
    const outside = screen.getByRole("button", { name: "Outside" });
    if (!details) throw new Error("No details element");
    fireEvent.focusOut(trigger, { relatedTarget: outside });
    expect(details.hasAttribute("open")).toBe(false);
  });
});
