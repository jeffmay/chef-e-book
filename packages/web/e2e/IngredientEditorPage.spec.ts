import { test, expect } from "@playwright/test";

test.describe("Ingredient Editor", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.fill('input[type="text"]', "TestUser");
    await page.click('button:has-text("Create book")');
    await page.waitForTimeout(1000);
    await page.click("text=/☰/");
    await page.waitForTimeout(500);
    await page.click("text=/Ingredients/");
    await page.waitForTimeout(1000);
  });

  test("navigates to bulk ingredient editor and shows table", async ({ page }) => {
    const table = page.locator("table, .p-treetable");
    await expect(table.first()).toBeVisible();
  });

  test("LabelEditor dropdown opens and ArrowDown navigates within it", async ({ page }) => {
    const labelsHeaderIndex = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll("th"));
      return headers.findIndex((h) => h.textContent.includes("Labels"));
    });

    expect(labelsHeaderIndex).toBeGreaterThanOrEqual(0);

    const labelsCell = page
      .locator(
        `tbody tr:first-child td:nth-child(${labelsHeaderIndex + 1}) span.ingredients-table-editable`,
      )
      .first();
    await expect(labelsCell).toBeVisible();
    await labelsCell.click();
    await page.waitForTimeout(500);

    const labelEditor = page
      .locator(".label-editor__control, .ingredients-table-label-editor")
      .first();
    await expect(labelEditor).toBeVisible();

    const dropdownMenu = page.locator(".label-editor__menu").first();
    await expect(dropdownMenu).toBeVisible();

    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(300);

    const isDropdownNavigated = await page.evaluate(() => {
      const combobox = document.querySelector("[role='combobox'][aria-expanded='true']");
      if (!combobox) return false;
      const activedescendant = combobox.getAttribute("aria-activedescendant");
      if (!activedescendant) return false;
      const option = document.getElementById(activedescendant);
      return option !== null && option.getAttribute("role") === "option";
    });

    expect(isDropdownNavigated).toBe(true);

    const dropdownStillOpen = await page.locator(".label-editor__menu").first().isVisible();
    expect(dropdownStillOpen).toBe(true);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  });

  test("LabelEditor ArrowDown does not move focus to a table row", async ({ page }) => {
    const labelsHeaderIndex = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll("th"));
      return headers.findIndex((h) => h.textContent.includes("Labels"));
    });
    expect(labelsHeaderIndex).toBeGreaterThanOrEqual(0);

    const labelsCell = page
      .locator(
        `tbody tr:first-child td:nth-child(${labelsHeaderIndex + 1}) span.ingredients-table-editable`,
      )
      .first();
    await labelsCell.click();
    await page.waitForTimeout(500);

    // Dropdown must be open before we can test navigation
    await expect(page.locator(".label-editor__menu").first()).toBeVisible();

    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(300);

    // Focus must still be inside the LabelEditor combobox, not on a bare table row
    const focusEscaped = await page.evaluate(() => {
      const focused = document.activeElement;
      if (!focused) return true;
      const inLabelEditor = focused.closest(".label-editor__control") !== null;
      return !inLabelEditor;
    });
    expect(focusEscaped).toBe(false);

    // Dropdown must still be open
    await expect(page.locator(".label-editor__menu").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  });

  test("IngredientSelector ArrowDown does not move focus outside the dropdown panel", async ({
    page,
  }) => {
    const parentHeaderIndex = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll("th"));
      return headers.findIndex((h) => h.textContent?.includes("Parent"));
    });
    expect(parentHeaderIndex).toBeGreaterThanOrEqual(0);

    const parentCell = page
      .locator(
        `tbody tr:first-child td:nth-child(${parentHeaderIndex + 1}) span.ingredients-table-editable`,
      )
      .first();
    await parentCell.click();
    await page.waitForTimeout(500);

    const panel = page.locator(".ingredient-selector-panel").first();
    await expect(panel).toBeVisible();

    // Focus on the filter input inside the panel
    const filterInput = page.locator(".ingredient-selector-panel input[type='text']").first();
    await filterInput.click();

    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(300);

    // Panel must still be open
    await expect(panel).toBeVisible();

    // Focus must be within the panel or on the selector itself — not on a bare table row
    const focusEscaped = await page.evaluate(() => {
      const focused = document.activeElement;
      if (!focused) return true;
      const inPanel = focused.closest(".ingredient-selector-panel") !== null;
      const inSelector = focused.closest(".ingredient-selector-tree") !== null;
      return !inPanel && !inSelector;
    });
    expect(focusEscaped).toBe(false);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  });

  test("MeasurementEditor closes on Escape key", async ({ page }) => {
    const valueHeaderIndex = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll("th"));
      return headers.findIndex((h) => h.textContent.includes("Default"));
    });

    expect(valueHeaderIndex).toBeGreaterThanOrEqual(0);

    const valueCell = page
      .locator(
        `tbody tr:first-child td:nth-child(${valueHeaderIndex + 1}) span.ingredients-table-editable`,
      )
      .first();
    await expect(valueCell).toBeVisible();
    await valueCell.click();
    await page.waitForTimeout(500);

    const editor = page.locator(".measurement-editor-root--open, .fraction-editor-header").first();
    await expect(editor).toBeVisible();

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    const editorStillVisible = await page
      .locator(".measurement-editor-root--open")
      .first()
      .isVisible();
    expect(editorStillVisible).toBe(false);
  });

  test("IngredientSelector panel renders as portal outside the table", async ({ page }) => {
    const parentHeaderIndex = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll("th"));
      return headers.findIndex((h) => h.textContent?.includes("Parent"));
    });
    expect(parentHeaderIndex).toBeGreaterThanOrEqual(0);

    const parentCell = page
      .locator(
        `tbody tr:first-child td:nth-child(${parentHeaderIndex + 1}) span.ingredients-table-editable`,
      )
      .first();
    await expect(parentCell).toBeVisible();
    await parentCell.click();
    await page.waitForTimeout(500);

    const panel = page.locator(".ingredient-selector-panel").first();
    await expect(panel).toBeVisible();

    // Verify the panel is NOT inside the table — it renders as a body-level portal
    const isPortal = await page.evaluate(() => {
      const panel = document.querySelector(".ingredient-selector-panel");
      if (!panel) return false;
      let el: Element | null = panel.parentElement;
      while (el) {
        if (el.classList.contains("p-treetable")) return false;
        el = el.parentElement;
      }
      return true;
    });
    expect(isPortal).toBe(true);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  });

  test("IngredientSelector panel is fully visible in viewport after opening", async ({ page }) => {
    const parentHeaderIndex = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll("th"));
      return headers.findIndex((h) => h.textContent?.includes("Parent"));
    });

    const parentCell = page
      .locator(
        `tbody tr:first-child td:nth-child(${parentHeaderIndex + 1}) span.ingredients-table-editable`,
      )
      .first();
    await parentCell.click();
    await page.waitForTimeout(500);

    const panelInViewport = await page.evaluate(() => {
      const panel = document.querySelector(".ingredient-selector-panel");
      if (!panel) return false;
      const rect = panel.getBoundingClientRect();
      // Allow a small tolerance below the fold for the panel bottom edge
      return rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight + 100;
    });
    expect(panelInViewport).toBe(true);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  });

  test("IngredientSelector filter input accepts keyboard input", async ({ page }) => {
    const parentHeaderIndex = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll("th"));
      return headers.findIndex((h) => h.textContent?.includes("Parent"));
    });

    const parentCell = page
      .locator(
        `tbody tr:first-child td:nth-child(${parentHeaderIndex + 1}) span.ingredients-table-editable`,
      )
      .first();
    await parentCell.click();
    await page.waitForTimeout(500);

    const filterInput = page.locator(".ingredient-selector-panel input[type='text']").first();
    await expect(filterInput).toBeVisible();
    await filterInput.fill("Butter");
    await page.waitForTimeout(300);

    await expect(filterInput).toHaveValue("Butter");
    // Panel stays open while typing
    await expect(page.locator(".ingredient-selector-panel").first()).toBeVisible();

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  });

  test("MultiSelectFilter shows accept/revert buttons in viewport", async ({ page }) => {
    const filterInputs = page.locator(
      ".ingredients-table-filter-th .multi-select-filter-wrapper .multi-select-filter-input, th input.multi-select-filter-input",
    );
    await expect(filterInputs.first()).toBeVisible();

    const labelsFilter = filterInputs.nth(0);
    await labelsFilter.click();
    await page.waitForTimeout(500);

    const dropdown = page.locator(".multi-select-filter-dropdown").first();
    await expect(dropdown).toBeVisible();

    const acceptBtn = page.locator(".multi-select-filter-actions button:first-child").first();
    const revertBtn = page.locator(".multi-select-filter-actions button:last-child").first();

    await expect(acceptBtn).toBeVisible();
    await expect(revertBtn).toBeVisible();

    const buttonsInViewport = await page.evaluate(() => {
      const actions = document.querySelector(".multi-select-filter-actions");
      if (!actions) return false;
      const rect = actions.getBoundingClientRect();
      return rect.top > 0 && rect.bottom <= window.innerHeight;
    });

    expect(buttonsInViewport).toBe(true);

    await page.mouse.click(0, 0);
    await page.waitForTimeout(300);
  });
});
