import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoutesStub } from "react-router";
import { USER_STORAGE_KEY } from "../hooks/useUser.js";

vi.mock("y-indexeddb", () => ({
  IndexeddbPersistence: vi.fn().mockImplementation(() => ({
    destroy: vi.fn(),
    whenSynced: Promise.resolve(),
  })),
}));

const { default: Root } = await import("../root.js");
const { default: Dashboard } = await import("../routes/dashboard.js");
const { default: Profile } = await import("../routes/profile.js");

function makeStub(initialEntries = ["/dashboard"]) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: Root,
      children: [
        {
          path: "dashboard",
          Component: Dashboard,
        },
        {
          path: "ingredients",
          Component: () => (
            <main>
              <h1>Ingredients</h1>
            </main>
          ),
        },
        {
          path: "profile",
          Component: Profile,
        },
      ],
    },
  ]);
  return <Stub initialEntries={initialEntries} />;
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ text: () => Promise.resolve("") }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App — no user stored", () => {
  it("shows SelectUserPage when no user is in localStorage", () => {
    render(makeStub());
    expect(screen.getByRole("heading", { name: "Recipe Book" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get Started" })).toBeInTheDocument();
  });

  it("transitions to home after entering a name", async () => {
    render(makeStub());
    await userEvent.type(screen.getByLabelText("Your name"), "Alice");
    await userEvent.click(screen.getByRole("button", { name: "Get Started" }));
    expect(screen.getByLabelText("Navigation menu")).toBeInTheDocument();
    expect(screen.getByLabelText("User menu for Alice")).toBeInTheDocument();
  });

  it("persists the user name in localStorage after selection", async () => {
    render(makeStub());
    await userEvent.type(screen.getByLabelText("Your name"), "Alice");
    await userEvent.click(screen.getByRole("button", { name: "Get Started" }));
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBe("Alice");
  });
});

describe("App — user already stored", () => {
  beforeEach(() => {
    localStorage.setItem(USER_STORAGE_KEY, "Bob");
  });

  it("shows home content when user is already stored", () => {
    render(makeStub());
    expect(screen.getByLabelText("Navigation menu")).toBeInTheDocument();
    expect(screen.getByLabelText("Undo")).toBeInTheDocument();
    expect(screen.getByLabelText("User menu for Bob")).toBeInTheDocument();
  });

  it("navigates to Ingredients via the nav menu", async () => {
    render(makeStub());
    await userEvent.click(screen.getByLabelText("Navigation menu"));
    await userEvent.click(screen.getByRole("link", { name: "Ingredients" }));
    expect(screen.getByRole("heading", { name: "Ingredients" })).toBeInTheDocument();
  });

  it("navigates to profile settings via the user menu", async () => {
    render(makeStub());
    await userEvent.click(screen.getByLabelText("User menu for Bob"));
    await userEvent.click(screen.getByRole("menuitem", { name: "Profile settings" }));
    expect(screen.getByRole("heading", { name: "Profile Settings" })).toBeInTheDocument();
  });

  it("returns to dashboard after cancelling profile settings", async () => {
    render(makeStub(["/profile"]));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Your recipes will appear here.")).toBeInTheDocument();
  });

  it("updates the user name after saving profile settings", async () => {
    render(makeStub(["/profile"]));
    const input = screen.getByLabelText("Your name");
    await userEvent.clear(input);
    await userEvent.type(input, "Robert");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBe("Robert");
    expect(screen.getByLabelText("User menu for Robert")).toBeInTheDocument();
  });
});
