import { initFromKitchenwareTemplates, parseKitchenwareCsv } from "@recipe-book/shared";
import { act } from "@testing-library/react";
import type * as Y from "yjs";

/**
 * Flushes pending asynchronous effects inside React's `act(...)`.
 *
 * Doc-backed stores (e.g. `useIngredientStore`, `useContainerStore`) schedule
 * state updates from promise callbacks that resolve *after* a synchronous test
 * body returns — the `whenSynced.then(() => setState(...))` re-read and the async
 * CSV import chain. When those `setState` calls land outside `act(...)`, React
 * logs "An update to … was not wrapped in act(...)".
 *
 * Awaiting this helper after rendering drains the microtask queue (and any
 * chained promises) inside `act(...)`, so the resulting updates are wrapped and
 * the warning is silenced. A `setTimeout(0)` macrotask is used so multi-step
 * promise chains (await whenSynced → await fetch → await text) fully settle.
 */
export async function flushAsyncEffects(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/**
 * Fills a document with default kitchenware parsed from `csv`, the way a freshly seeded book looks,
 * without fetching anything. Use it in place of stubbing `fetch` for tests that need ingredients.
 */
export function seedKitchenwareFromCsv(doc: Y.Doc, csv: string): void {
  initFromKitchenwareTemplates(doc, parseKitchenwareCsv(csv));
}
