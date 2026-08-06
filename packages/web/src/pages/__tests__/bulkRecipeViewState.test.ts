import { fixedId, RecipeFolderId, RecipeId } from "@recipe-book/shared";
import { type } from "arktype";
import { describe, expect, it } from "vitest";
import {
  BulkRecipeViewState,
  collapsedFolderIds,
  collapsedRecipeIds,
  fullyExpandedBulkRecipeView,
  toggleFolderCollapsed,
  toggleRecipeCollapsed,
  toggleRootCollapsed,
} from "../bulkRecipeViewState.ts";

const MAINS = fixedId(RecipeFolderId, "mains");
const SOUPS = fixedId(RecipeFolderId, "soups");
const PIE = fixedId(RecipeId, "pie");

describe("fullyExpandedBulkRecipeView", () => {
  it("collapses nothing, so every folder and recipe starts expanded", () => {
    const viewState = fullyExpandedBulkRecipeView();
    expect(viewState.root_collapsed).toBe(false);
    expect(collapsedFolderIds(viewState).size).toBe(0);
    expect(collapsedRecipeIds(viewState).size).toBe(0);
  });

  it("validates against the schema", () => {
    expect(BulkRecipeViewState.type(fullyExpandedBulkRecipeView())).not.toBeInstanceOf(type.errors);
  });
});

describe("toggleRootCollapsed", () => {
  it("collapses then re-expands the root", () => {
    const collapsed = toggleRootCollapsed(fullyExpandedBulkRecipeView());
    expect(collapsed.root_collapsed).toBe(true);
    expect(toggleRootCollapsed(collapsed).root_collapsed).toBe(false);
  });

  it("leaves the collapsed folder and recipe lists alone", () => {
    const withFolder = toggleFolderCollapsed(fullyExpandedBulkRecipeView(), MAINS);
    expect(collapsedFolderIds(toggleRootCollapsed(withFolder))).toEqual(new Set([MAINS]));
  });
});

describe("toggleFolderCollapsed", () => {
  it("adds then removes the folder id", () => {
    const collapsed = toggleFolderCollapsed(fullyExpandedBulkRecipeView(), MAINS);
    expect(collapsedFolderIds(collapsed)).toEqual(new Set([MAINS]));
    expect(collapsedFolderIds(toggleFolderCollapsed(collapsed, MAINS)).size).toBe(0);
  });

  it("keeps other collapsed folders", () => {
    const both = toggleFolderCollapsed(
      toggleFolderCollapsed(fullyExpandedBulkRecipeView(), MAINS),
      SOUPS,
    );
    expect(collapsedFolderIds(both)).toEqual(new Set([MAINS, SOUPS]));
    expect(collapsedFolderIds(toggleFolderCollapsed(both, MAINS))).toEqual(new Set([SOUPS]));
  });

  it("does not mutate the state it was given", () => {
    const original = fullyExpandedBulkRecipeView();
    toggleFolderCollapsed(original, MAINS);
    expect(original.collapsed_folder_ids).toEqual([]);
  });
});

describe("toggleRecipeCollapsed", () => {
  it("adds then removes the recipe id", () => {
    const collapsed = toggleRecipeCollapsed(fullyExpandedBulkRecipeView(), PIE);
    expect(collapsedRecipeIds(collapsed)).toEqual(new Set([PIE]));
    expect(collapsedRecipeIds(toggleRecipeCollapsed(collapsed, PIE)).size).toBe(0);
  });

  it("does not touch the collapsed folder list", () => {
    const withFolder = toggleFolderCollapsed(fullyExpandedBulkRecipeView(), MAINS);
    expect(collapsedFolderIds(toggleRecipeCollapsed(withFolder, PIE))).toEqual(new Set([MAINS]));
  });
});
