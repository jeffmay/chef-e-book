import { type KitchenwareTemplate, parseKitchenwareCsv } from "@recipe-book/shared";

/** The default kitchenware, as shipped in the static `kitchenware.csv` asset. */
export const DEFAULT_KITCHENWARE_URL = "/kitchenware.csv";

export async function loadDefaultKitchenware(): Promise<KitchenwareTemplate[]> {
  const response = await fetch(DEFAULT_KITCHENWARE_URL);
  if (!response.ok) {
    throw new Error(`failed to fetch ${DEFAULT_KITCHENWARE_URL}: HTTP ${response.status}`);
  }
  return parseKitchenwareCsv(await response.text());
}
