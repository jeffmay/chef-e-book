import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { fixedId, RecipeBookId } from "@recipe-book/shared";
import { type ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { NavMenu } from "../NavMenu.tsx";

const BOB = { id: fixedId(RecipeBookId, "bob"), name: "Bob", created_at: 1, last_opened_at: 2 };
const CAROL = {
  id: fixedId(RecipeBookId, "carol"),
  name: "Carol",
  created_at: 1,
  last_opened_at: 1,
};

function renderMenu(extraChildren?: ReactNode, props: Partial<Parameters<typeof NavMenu>[0]> = {}) {
  return render(
    <MemoryRouter>
      <NavMenu
        books={[BOB, CAROL]}
        activeBookId={BOB.id}
        onSwitchBook={vi.fn()}
        onOpenBook={vi.fn()}
        {...props}
      />
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

  it("Book Settings link points to /settings", async () => {
    renderMenu();
    await userEvent.click(screen.getByLabelText("Navigation menu"));
    expect(screen.getByRole("link", { name: "Book Settings" })).toHaveAttribute(
      "href",
      "/settings",
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

  it("keeps the menu open when focus leaves without a related target (mobile link tap)", async () => {
    // On iOS Safari tapping a link does not focus it, so focusout fires with a
    // null relatedTarget. Closing here would hide the link before its click can
    // navigate, so the menu must stay open and let the click proceed.
    renderMenu();
    const trigger = screen.getByLabelText("Navigation menu");
    await userEvent.click(trigger);
    const details = trigger.closest("details");
    if (!details) throw new Error("No details element");
    expect(details.hasAttribute("open")).toBe(true);
    fireEvent.focusOut(trigger, { relatedTarget: null });
    expect(details.hasAttribute("open")).toBe(true);
  });

  it("goes to the book picker from Switch Books, closing the menu", async () => {
    const onSwitchBook = vi.fn();
    renderMenu(undefined, { onSwitchBook });
    const trigger = screen.getByLabelText("Navigation menu");
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("button", { name: "Switch Books" }));
    expect(onSwitchBook).toHaveBeenCalledOnce();
    expect(trigger.closest("details")?.hasAttribute("open")).toBe(false);
  });

  it("lists the device's books under Switch Books, marking the open one", async () => {
    renderMenu();
    await userEvent.click(screen.getByLabelText("Navigation menu"));
    const list = screen.getByRole("list", { name: "Books on this device" });
    expect(Array.from(list.querySelectorAll("button")).map((b) => b.textContent)).toEqual([
      "✔︎ Bob",
      "Carol",
    ]);
    expect(screen.getByRole("button", { name: "Bob (open book)" })).toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "Open book Carol" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("opens another book from the list, closing the menu", async () => {
    const onOpenBook = vi.fn();
    renderMenu(undefined, { onOpenBook });
    const trigger = screen.getByLabelText("Navigation menu");
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("button", { name: "Open book Carol" }));
    expect(onOpenBook).toHaveBeenCalledWith(CAROL.id);
    expect(trigger.closest("details")?.hasAttribute("open")).toBe(false);
  });

  it("only closes the menu when the open book is chosen from the list", async () => {
    const onOpenBook = vi.fn();
    renderMenu(undefined, { onOpenBook });
    const trigger = screen.getByLabelText("Navigation menu");
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("button", { name: "Bob (open book)" }));
    expect(onOpenBook).not.toHaveBeenCalled();
    expect(trigger.closest("details")?.hasAttribute("open")).toBe(false);
  });

  it("marks Switch Books with a right arrow that screen readers skip", async () => {
    renderMenu();
    await userEvent.click(screen.getByLabelText("Navigation menu"));
    const button = screen.getByRole("button", { name: "Switch Books" });
    expect(button).toHaveAttribute("aria-haspopup", "true");
    const arrow = button.querySelector(".nav-menu-arrow");
    expect(arrow).toHaveTextContent("▸");
    expect(arrow).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the book list in the same group as Switch Books so the flyout anchors to it", async () => {
    renderMenu();
    await userEvent.click(screen.getByLabelText("Navigation menu"));
    const group = screen.getByRole("button", { name: "Switch Books" }).closest(".nav-menu-group");
    expect(group).toContainElement(screen.getByRole("list", { name: "Books on this device" }));
  });

  it("names the open book as open, not as something to switch to", async () => {
    renderMenu();
    await userEvent.click(screen.getByLabelText("Navigation menu"));
    expect(screen.queryByRole("button", { name: "Open book Bob" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bob (open book)" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });
});
