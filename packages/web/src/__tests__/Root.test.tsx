import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoutesStub } from "react-router";
import { flushAsyncEffects } from "../testUtils.ts";
import { randomId, RecipeBookId } from "@recipe-book/shared";
import {
  BOOK_REGISTRY_KEY,
  BookRegistry,
  LEGACY_ACTIVE_BOOK_KEY,
} from "../storage/bookRegistry.ts";
import { type } from "arktype";

vi.mock("y-indexeddb", () => ({
  IndexeddbPersistence: vi.fn().mockImplementation(() => ({
    destroy: vi.fn(),
    whenSynced: Promise.resolve(),
  })),
}));

const { default: Root } = await import("../root.tsx");
const { default: Dashboard } = await import("../routes/dashboard.tsx");
const { default: Settings } = await import("../routes/settings.tsx");
const { useIngredientStore } = await import("../hooks/useIngredientStore.ts");
// const { default: Profile } = await import("../routes/profile.ts");

/** A page that edits the book, to exercise the header's Undo. */
function AddIngredientPage() {
  const { createIngredient } = useIngredientStore();
  return (
    <main>
      <button
        onClick={() =>
          createIngredient({
            name: "Vanilla",
            default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" },
            label_names: [],
          })
        }
      >
        Add ingredient
      </button>
    </main>
  );
}

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
          path: "add",
          Component: AddIngredientPage,
        },
        {
          path: "settings",
          Component: Settings,
        },
        {
          path: "ingredients",
          Component: () => (
            <main>
              <h1>Ingredients</h1>
            </main>
          ),
        },
        // {
        //   path: "profile",
        //   Component: Profile,
        // },
      ],
    },
  ]);
  return <Stub initialEntries={initialEntries} />;
}

// What the default-kitchenware seed fetches when a book first opens.
const KITCHENWARE_CSV = `Unique ID,Type,Description,Default Measurement Type,Labels
------butter,ingredient,Butter,volume,fat+solid
`;

/** The registry as stored in localStorage, validated. */
function storedRegistry(): BookRegistry {
  const registry = BookRegistry.type(JSON.parse(localStorage.getItem(BOOK_REGISTRY_KEY) || ""));
  if (registry instanceof type.errors) {
    expect.fail(registry.summary);
  }
  return registry;
}

function storeRegistry(id: RecipeBookId, name: string) {
  localStorage.setItem(
    BOOK_REGISTRY_KEY,
    JSON.stringify({
      books: [{ id, name, created_at: 1, last_opened_at: 1 }],
      active_book_id: id,
    }),
  );
}

/** Opens the navigation menu and chooses "Switch Books", which leaves the open book for the picker. */
async function switchToPicker() {
  await userEvent.click(screen.getByLabelText("Navigation menu"));
  await userEvent.click(screen.getByRole("button", { name: "Switch Books" }));
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(KITCHENWARE_CSV) }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Root — no book stored", () => {
  it("shows SelectBookPage when no book is in localStorage", () => {
    render(makeStub());
    expect(screen.getByRole("heading", { name: "Recipe Book" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create book" })).toBeInTheDocument();
  });

  it("transitions to home after entering a book name", async () => {
    render(makeStub());
    await userEvent.type(screen.getByLabelText("Book name"), "Alice");
    await userEvent.click(screen.getByRole("button", { name: "Create book" }));
    expect(screen.getByLabelText("Navigation menu")).toBeInTheDocument();
    // expect(screen.getByLabelText("User menu for Alice")).toBeInTheDocument();
  });

  it("stores the new book in the device registry, and opens it", async () => {
    render(makeStub());
    await userEvent.type(screen.getByLabelText("Book name"), "Alice");
    await userEvent.click(screen.getByRole("button", { name: "Create book" }));
    const registry = storedRegistry();
    expect(registry.books).toHaveLength(1);
    expect(registry.books[0]?.name).toBe("Alice");
    expect(registry.active_book_id).toBe(registry.books[0]?.id);
  });
});

describe("Root — book stored by an earlier build", () => {
  const bookId = randomId(RecipeBookId);

  beforeEach(() => {
    localStorage.setItem(LEGACY_ACTIVE_BOOK_KEY, JSON.stringify({ id: bookId, name: "Old Book" }));
  });

  it("opens the legacy book instead of asking for a name", () => {
    render(makeStub());
    expect(screen.getByLabelText("Navigation menu")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Old Book" })).toBeInTheDocument();
  });

  it("moves it into the registry and removes the legacy key", () => {
    render(makeStub());
    const registry = storedRegistry();
    expect(registry.active_book_id).toBe(bookId);
    expect(registry.books[0]?.name).toBe("Old Book");
    expect(localStorage.getItem(LEGACY_ACTIVE_BOOK_KEY)).toBeNull();
  });
});

describe("Root — book already stored", () => {
  const bookId = randomId(RecipeBookId);
  const otherBookId = randomId(RecipeBookId);

  beforeEach(() => {
    storeRegistry(bookId, "Bob");
  });

  it("shows home content when book is already stored", () => {
    render(makeStub());
    expect(screen.getByLabelText("Navigation menu")).toBeInTheDocument();
    expect(screen.getByLabelText("Undo")).toBeInTheDocument();
    // expect(screen.getByLabelText("User menu for Bob")).toBeInTheDocument();
  });

  it("navigates to Ingredients via the nav menu", async () => {
    render(makeStub());
    await userEvent.click(screen.getByLabelText("Navigation menu"));
    await userEvent.click(screen.getByRole("link", { name: "Ingredients" }));
    expect(screen.getByRole("heading", { name: "Ingredients" })).toBeInTheDocument();
  });

  it("shows the open book's name in the header", () => {
    render(makeStub());
    expect(screen.getByRole("heading", { name: "Bob" })).toBeInTheDocument();
  });

  describe("undo", () => {
    it("has nothing to undo in a freshly opened book, whatever the app set up itself", async () => {
      render(makeStub());
      // Let the book finish loading: its metadata is written and the default kitchenware seeded.
      await flushAsyncEffects();
      expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    });

    it("undoes an edit to the book, then has nothing left to undo", async () => {
      render(makeStub(["/add"]));
      await flushAsyncEffects();
      await userEvent.click(screen.getByRole("button", { name: "Add ingredient" }));
      expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();

      await userEvent.click(screen.getByRole("button", { name: "Undo" }));
      expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    });

    it("keeps the history when navigating to another page", async () => {
      render(makeStub(["/add"]));
      await flushAsyncEffects();
      await userEvent.click(screen.getByRole("button", { name: "Add ingredient" }));

      await userEvent.click(screen.getByLabelText("Navigation menu"));
      await userEvent.click(screen.getByRole("link", { name: "Ingredients" }));

      expect(screen.getByRole("heading", { name: "Ingredients" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
    });

    it("starts a book with an empty history each time it is opened", async () => {
      render(makeStub(["/add"]));
      await flushAsyncEffects();
      await userEvent.click(screen.getByRole("button", { name: "Add ingredient" }));
      expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();

      await switchToPicker();
      await userEvent.click(screen.getByRole("button", { name: "Open book Bob" }));
      await flushAsyncEffects();

      expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    });
  });

  describe("undo button", () => {
    it("shows an ✕ when there is nothing to undo, and an ↩ once there is", async () => {
      render(makeStub(["/add"]));
      await flushAsyncEffects();
      expect(screen.getByRole("button", { name: "Undo" })).toHaveTextContent("✕ Undo");

      await userEvent.click(screen.getByRole("button", { name: "Add ingredient" }));
      expect(screen.getByRole("button", { name: "Undo" })).toHaveTextContent("↩ Undo");
    });
  });

  describe("switching books", () => {
    it("has no separate Books button in the header any more", () => {
      render(makeStub());
      expect(screen.queryByRole("button", { name: "Books" })).not.toBeInTheDocument();
    });

    it("lists this device's books under Switch Books, marking the open one", async () => {
      localStorage.setItem(
        BOOK_REGISTRY_KEY,
        JSON.stringify({
          books: [
            { id: bookId, name: "Bob", created_at: 1, last_opened_at: 2 },
            { id: otherBookId, name: "Carol", created_at: 1, last_opened_at: 1 },
          ],
          active_book_id: bookId,
        }),
      );
      render(makeStub());
      await userEvent.click(screen.getByLabelText("Navigation menu"));
      const list = screen.getByRole("list", { name: "Books on this device" });
      expect(
        within(list)
          .getAllByRole("button")
          .map((b) => b.textContent),
      ).toEqual(["✔︎ Bob", "Carol"]);
      expect(screen.getByRole("button", { name: "Bob (open book)" })).toHaveAttribute(
        "aria-current",
      );
    });

    it("opens another book straight from the submenu", async () => {
      localStorage.setItem(
        BOOK_REGISTRY_KEY,
        JSON.stringify({
          books: [
            { id: bookId, name: "Bob", created_at: 1, last_opened_at: 2 },
            { id: otherBookId, name: "Carol", created_at: 1, last_opened_at: 1 },
          ],
          active_book_id: bookId,
        }),
      );
      render(makeStub());
      await userEvent.click(screen.getByLabelText("Navigation menu"));
      await userEvent.click(screen.getByRole("button", { name: "Open book Carol" }));
      await flushAsyncEffects();

      expect(screen.getByRole("heading", { name: "Carol" })).toBeInTheDocument();
      expect(storedRegistry().active_book_id).toBe(otherBookId);
    });

    it("goes to the picker, listing this device's books, from the Books button", async () => {
      render(makeStub());
      await switchToPicker();
      expect(screen.getByRole("heading", { name: "Your books" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Open book Bob" })).toBeInTheDocument();
      expect(storedRegistry().active_book_id).toBeUndefined();
    });

    it("opens a book chosen from the picker", async () => {
      render(makeStub());
      await switchToPicker();
      await userEvent.click(screen.getByRole("button", { name: "Open book Bob" }));
      expect(screen.getByLabelText("Navigation menu")).toBeInTheDocument();
      expect(storedRegistry().active_book_id).toBe(bookId);
    });

    it("creates a second book from the picker and opens it, keeping the first", async () => {
      render(makeStub());
      await switchToPicker();
      await userEvent.type(screen.getByLabelText("Book name"), "Carol");
      await userEvent.click(screen.getByRole("button", { name: "Create book" }));

      expect(screen.getByRole("heading", { name: "Carol" })).toBeInTheDocument();
      const registry = storedRegistry();
      expect(registry.books.map((b) => b.name).sort()).toEqual(["Bob", "Carol"]);
    });

    it("renames a book from the picker without changing its id", async () => {
      render(makeStub());
      await switchToPicker();
      await userEvent.click(screen.getByRole("button", { name: "Rename book Bob" }));
      const input = screen.getByLabelText("New name for Bob");
      await userEvent.clear(input);
      await userEvent.type(input, "Robert{Enter}");

      expect(await screen.findByRole("button", { name: "Open book Robert" })).toBeInTheDocument();
      const registry = storedRegistry();
      expect(registry.books).toHaveLength(1);
      expect(registry.books[0]).toMatchObject({ id: bookId, name: "Robert" });
    });

    it("deletes a book from the picker after confirmation", async () => {
      render(makeStub());
      await switchToPicker();
      await userEvent.click(screen.getByRole("button", { name: "Delete book Bob" }));
      await userEvent.click(screen.getByRole("button", { name: "Delete book" }));

      expect(screen.queryByRole("button", { name: "Open book Bob" })).not.toBeInTheDocument();
      expect(storedRegistry().books).toEqual([]);
    });
  });

  describe("book settings", () => {
    it("opens from the nav menu and shows the open book's name", async () => {
      render(makeStub());
      await userEvent.click(screen.getByLabelText("Navigation menu"));
      await userEvent.click(screen.getByRole("link", { name: "Book Settings" }));
      expect(screen.getByRole("heading", { name: "Book Settings" })).toBeInTheDocument();
      expect(screen.getByLabelText(/Book name/)).toHaveValue("Bob");
    });

    it("renames the open book, in the header and the registry, keeping its id", async () => {
      render(makeStub(["/settings"]));
      await flushAsyncEffects();
      const input = screen.getByLabelText(/Book name/);
      await userEvent.clear(input);
      await userEvent.type(input, "Robert{Enter}");
      await flushAsyncEffects();

      expect(screen.getByRole("heading", { name: "Robert", level: 1 })).toBeInTheDocument();
      expect(storedRegistry().books).toEqual([
        expect.objectContaining({ id: bookId, name: "Robert" }),
      ]);
    });

    it("does not delete until the confirmation is accepted", async () => {
      render(makeStub(["/settings"]));
      await flushAsyncEffects();
      await userEvent.click(screen.getByRole("button", { name: "Delete this book" }));
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.getByRole("heading", { name: "Book Settings" })).toBeInTheDocument();
      expect(storedRegistry().books).toHaveLength(1);
    });

    it("deletes the open book and returns to the book picker", async () => {
      render(makeStub(["/settings"]));
      await flushAsyncEffects();
      await userEvent.click(screen.getByRole("button", { name: "Delete this book" }));
      await userEvent.click(screen.getByRole("button", { name: "Delete book" }));
      await flushAsyncEffects();

      expect(screen.getByRole("button", { name: "Create book" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Open book Bob" })).not.toBeInTheDocument();
      expect(storedRegistry().books).toEqual([]);
      expect(storedRegistry().active_book_id).toBeUndefined();
    });

    it("keeps the other books when deleting the open one", async () => {
      localStorage.setItem(
        BOOK_REGISTRY_KEY,
        JSON.stringify({
          books: [
            { id: bookId, name: "Bob", created_at: 1, last_opened_at: 2 },
            { id: otherBookId, name: "Carol", created_at: 1, last_opened_at: 1 },
          ],
          active_book_id: bookId,
        }),
      );
      render(makeStub(["/settings"]));
      await flushAsyncEffects();
      await userEvent.click(screen.getByRole("button", { name: "Delete this book" }));
      await userEvent.click(screen.getByRole("button", { name: "Delete book" }));
      await flushAsyncEffects();

      expect(screen.getByRole("button", { name: "Open book Carol" })).toBeInTheDocument();
      expect(storedRegistry().books.map((b) => b.id)).toEqual([otherBookId]);
    });

    it("does not leave the next book opened on the deleted book's settings page", async () => {
      localStorage.setItem(
        BOOK_REGISTRY_KEY,
        JSON.stringify({
          books: [
            { id: bookId, name: "Bob", created_at: 1, last_opened_at: 2 },
            { id: otherBookId, name: "Carol", created_at: 1, last_opened_at: 1 },
          ],
          active_book_id: bookId,
        }),
      );
      render(makeStub(["/settings"]));
      await flushAsyncEffects();
      await userEvent.click(screen.getByRole("button", { name: "Delete this book" }));
      await userEvent.click(screen.getByRole("button", { name: "Delete book" }));
      await flushAsyncEffects();
      await userEvent.click(screen.getByRole("button", { name: "Open book Carol" }));
      await flushAsyncEffects();

      expect(screen.queryByRole("heading", { name: "Book Settings" })).not.toBeInTheDocument();
    });
  });

  // it("navigates to profile settings via the user menu", async () => {
  //   render(makeStub());
  //   await userEvent.click(screen.getByLabelText("User menu for Bob"));
  //   await userEvent.click(screen.getByRole("menuitem", { name: "Profile settings" }));
  //   expect(screen.getByRole("heading", { name: "Profile Settings" })).toBeInTheDocument();
  // });

  // it("returns to dashboard after cancelling profile settings", async () => {
  //   render(makeStub(["/profile"]));
  //   await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  //   expect(screen.getByText("Your recipes will appear here.")).toBeInTheDocument();
  // });

  // it("updates the user name after saving profile settings", async () => {
  //   render(makeStub(["/profile"]));
  //   const input = screen.getByLabelText("Your name");
  //   await userEvent.clear(input);
  //   await userEvent.type(input, "Robert");
  //   await userEvent.click(screen.getByRole("button", { name: "Save" }));
  //   const activeBook = ActiveBookMeta.type(JSON.parse(localStorage.getItem(ACTIVE_BOOK_KEY) || ""));
  //   if (activeBook instanceof type.errors) {
  //     expect.fail(activeBook.summary);
  //   } else {
  //     expect(activeBook.name).toBe("Robert");
  //   }
  //   expect(screen.getByLabelText("User menu for Robert")).toBeInTheDocument();
  // });
});
