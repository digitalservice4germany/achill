import { test, expect } from "@playwright/test";
import LoginPage from "./LoginPage";

test.describe("work time actions", () => {
  test("should add, edit and delete work time", async ({ page }) => {
    await new LoginPage(page).logIn("max.mustermann", "aSafePassword");
    await expect(page.locator("text=Total working hours")).toBeVisible();

    // Check if the work time display is visible
    const worktimeDisplayWeekDay = "#workhours-" + new Date().getDay();
    await expect(page.locator(worktimeDisplayWeekDay)).toBeVisible();
    const worktimeDisplayLive = "#workhours-live-display";
    await expect(page.locator(worktimeDisplayLive)).toBeVisible();

    // Input start time, break and end time and submit form
    await page.getByLabel("Start time").fill("08:00");
    await page.getByLabel("Break").fill("01:00");
    await page.getByLabel("End time").fill("17:00");

    // Check if the saved work time is zero
    await expect(page.locator(worktimeDisplayWeekDay)).toHaveText("0");
    // Check if the work time live display is right
    await expect(page.locator(worktimeDisplayLive)).toHaveText("8:00");

    await page
      .locator("#work-time-form button")
      .filter({ hasText: "Save" })
      .click();

    // Check if the new saved work time is visible
    await expect(page.locator(worktimeDisplayWeekDay)).toBeVisible();
    await expect(page.locator(worktimeDisplayWeekDay)).toHaveText("8:00");

    // Click on the edit button
    await page
      .locator("#work-time-form button")
      .filter({ hasText: "Edit" })
      .click();

    // Change the start time and submit the form
    await page.getByLabel("Start time").fill("09:00");

    // Check if work time live display changed accordingly
    await expect(page.locator(worktimeDisplayLive)).toHaveText("7:00");

    await page
      .locator("#work-time-form button")
      .filter({ hasText: "Update" })
      .click();

    // Check if the new saved work time is visible
    await expect(page.locator(worktimeDisplayWeekDay)).toHaveText("7:00");

    // Click on the delete button
    await page
      .locator("#work-time-form button")
      .filter({ hasText: "Delete" })
      .click();

    // Check if the work time is no longer visible
    await expect(page.locator(worktimeDisplayWeekDay)).toHaveText("0");
  });
});
