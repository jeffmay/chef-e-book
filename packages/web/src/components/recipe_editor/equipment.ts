import { EquipmentId, fixedId } from "@recipe-book/shared";

/**
 * Default selectable equipment offered when building an instruction. Shared
 * between the instruction editor row and the instruction summary so both render
 * the same display names.
 */
export const COMMON_EQUIPMENT = [
  { id: fixedId(EquipmentId, "oven"), name: "Oven" },
  { id: fixedId(EquipmentId, "stove"), name: "Stove" },
  { id: fixedId(EquipmentId, "mixer"), name: "Mixer" },
  { id: fixedId(EquipmentId, "blender"), name: "Blender" },
  { id: fixedId(EquipmentId, "knife"), name: "Knife" },
  { id: fixedId(EquipmentId, "skillet"), name: "Skillet" },
] as const;
