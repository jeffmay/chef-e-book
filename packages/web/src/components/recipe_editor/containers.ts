import { ContainerId, fixedId } from "@recipe-book/shared";

/**
 * Default selectable containers offered when building a recipe. Shared between
 * the container editor row and the instruction ingredient tree so both render
 * the same display names.
 */
export const COMMON_CONTAINERS = [
  { id: fixedId(ContainerId, "bowl"), name: "Bowl" },
  { id: fixedId(ContainerId, "pot"), name: "Pot" },
  { id: fixedId(ContainerId, "steamer"), name: "Steamer" },
  { id: fixedId(ContainerId, "foil"), name: "Foil" },
  { id: fixedId(ContainerId, "pan"), name: "Pan" },
  { id: fixedId(ContainerId, "plate"), name: "Plate" },
] as const;
