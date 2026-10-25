import { expect, test, type Page } from "@playwright/test";
import {
  ampmGroup,
  cityInput,
  coordinateInputs,
  dateError,
  formError,
  gotoApp,
  placeLabelInput,
  previewSvg,
  previewText,
  submitButton,
  timezoneSelect,
} from "./support/form";

/**
 * Form-contract test for the GOGAJI birth form.
 *
 * It pins the CURRENT UI contract (ids, roles, labels, option sets) and then
 * proves the form actually validates: incomplete or impossible input must
 * never reach the wallpaper renderer.
 */

/**
 * The manual coordinate block sits behind a disclosure (the city search is the
 * default path), so it has to be opened before its controls can be asserted.
 */
const openManualEntry = async (page: Page) => {
  const toggle = page.locator("#toggle-manual");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
};

/** The optional seconds box is behind a disclosure too. */
const revealSeconds = async (page: Page) => {
  const toggle = page.locator("#toggle-seconds");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
};

test.describe("GOGAJI birth form contract", () => {
  test("the form exposes the expected name, date and time controls", async ({ page }) => {
    await gotoApp(page);

    // --- name -------------------------------------------------------------
    await expect(page.locator("#full-name")).toBeVisible();
    await expect(page.locator('label[for="full-name"]')).toHaveText("Full name");

    // --- birth date: month <select>, day and year number inputs -----------
    await expect(page.locator('label[for="birth-date"]')).toHaveText("Birth date");
    await expect(page.locator("#birth-date")).toBeVisible();
    const monthOptions = await page.locator("#birth-date option").allTextContents();
    expect(monthOptions).toHaveLength(12);
    expect(monthOptions[0]).toBe("January");
    expect(monthOptions[7]).toBe("August");
    expect(monthOptions[11]).toBe("December");

    await expect(page.locator("#birth-day")).toBeVisible();
    await expect(page.locator("#birth-day")).toHaveAttribute("type", "number");
    await expect(page.locator("#birth-day")).toHaveAttribute("aria-label", "Day of birth");

    await expect(page.locator("#birth-year")).toBeVisible();
    await expect(page.locator("#birth-year")).toHaveAttribute("type", "number");
    await expect(page.locator("#birth-year")).toHaveAttribute("aria-label", "Year of birth");
    // The year is bounded to a plausible human range.
    await expect(page.locator("#birth-year")).toHaveAttribute("min", "1900");

    // --- birth time: 12-hour select, AM/PM group, minute, optional seconds -
    await expect(page.locator('label[for="birth-time"]')).toHaveText("Time of birth");
    const hourOptions = await page.locator("#birth-time option").allTextContents();
    expect(hourOptions).toHaveLength(12);
    expect(hourOptions[0]).toBe("1");
    expect(hourOptions[11]).toBe("12");

    const group = ampmGroup(page);
    await expect(group).toBeVisible();
    await expect(group.getByRole("button", { name: "AM", exact: true })).toBeVisible();
    await expect(group.getByRole("button", { name: "PM", exact: true })).toBeVisible();
    await expect(group.getByRole("button", { name: "AM", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(group.getByRole("button", { name: "PM", exact: true })).toHaveAttribute("aria-pressed", "false");

    const minuteOptions = await page.locator("#birth-minute option").allTextContents();
    expect(minuteOptions).toHaveLength(60);
    expect(minuteOptions[0]).toBe("00");
    expect(minuteOptions[59]).toBe("59");

    // The seconds box is optional, so it is hidden until it is asked for.
    await expect(page.locator("#birth-seconds")).toHaveCount(0);
    await revealSeconds(page);
    await expect(page.locator("#birth-seconds")).toBeVisible();
    await expect(page.locator("#birth-seconds")).toHaveAttribute("type", "number");
    await expect(page.locator("#birth-seconds")).toHaveAttribute("max", "59");
  });

  test("the form exposes place, coordinates, timezone, themes and submit", async ({ page }) => {
    await gotoApp(page);

    // --- place search + manual entry --------------------------------------
    await expect(cityInput(page)).toBeVisible();
    await expect(cityInput(page)).toHaveAttribute("placeholder", "City, e.g. New Delhi");
    await expect(page.getByRole("button", { name: "Find", exact: true })).toBeVisible();

    // The manual block starts closed: the city search is the default path.
    await expect(coordinateInputs(page)).toHaveCount(0);
    await expect(placeLabelInput(page)).toHaveCount(0);
    await openManualEntry(page);

    await expect(placeLabelInput(page)).toHaveCount(1);
    await expect(page.getByText("Place label", { exact: true })).toBeVisible();

    const coords = coordinateInputs(page);
    await expect(coords).toHaveCount(2);
    await expect(coords.nth(0)).toBeVisible();
    await expect(coords.nth(1)).toBeVisible();
    await expect(page.getByText("Latitude", { exact: true })).toBeVisible();
    await expect(page.getByText("Longitude", { exact: true })).toBeVisible();

    // --- timezone ----------------------------------------------------------
    const tz = timezoneSelect(page);
    await expect(tz).toHaveCount(1);
    await expect(tz).toBeVisible();
    await expect(tz.locator('option[value="Asia/Kolkata"]')).toHaveCount(1);
    expect(await tz.inputValue()).toBe("Asia/Kolkata");
    await expect(page.getByText("Timezone (IANA)", { exact: true })).toBeVisible();

    // --- style presets ----------------------------------------------------
    for (const preset of [
      "Temple Gold",
      "Indigo Midnight",
      "Minimal Line-Art",
      "Dense Mandala",
      "Royal Marigold",
    ]) {
      await expect(page.getByRole("button", { name: preset, exact: true })).toBeVisible();
    }

    // --- submit ------------------------------------------------------------
    await expect(submitButton(page)).toBeVisible();
    await expect(submitButton(page)).toHaveText("Create my wallpaper");
    await expect(submitButton(page)).toBeEnabled();

    // --- the AI step is optional and OFF by default ------------------------
    const ai = page.locator("#use-ai");
    await expect(ai).toBeVisible();
    await expect(ai).not.toBeChecked();
    await expect(page.getByText("AI reading & premium wallpaper", { exact: true })).toBeVisible();
  });

  test("the wallpaper is drawn live, without waiting for the submit", async ({ page }) => {
    await gotoApp(page);
    await expect(previewSvg(page)).toHaveCount(0);
    await expect(submitButton(page)).toBeVisible();

    // A name plus the prefilled details is enough: the chart is computed as
    // the visitor types, so the artwork is already on screen.
    await page.locator("#full-name").fill("Kala Devi");
    await expect(previewSvg(page)).toHaveCount(1, { timeout: 20_000 });
    expect((await previewText(page)).toUpperCase()).toContain("KALA DEVI");
  });

  test("a missing name is rejected and produces no preview", async ({ page }) => {
    await gotoApp(page);
    await submitButton(page).click();

    await expect(formError(page)).toBeVisible();
    await expect(formError(page)).toContainText("Please add a name");
    await expect(previewSvg(page)).toHaveCount(0);
  });

  test("an impossible day is rejected and produces no preview", async ({ page }) => {
    await gotoApp(page);
    await page.locator("#full-name").fill("Kala Devi");
    await page.locator("#birth-date").selectOption("2");
    await page.locator("#birth-year").fill("1990");
    await page.locator("#birth-day").fill("30");

    // 1990 is not a leap year: February has 28 days.
    await expect(dateError(page)).toHaveText("February 1990 has 28 days.");
    // An impossible date invalidates the live chart too.
    await expect(previewSvg(page)).toHaveCount(0);

    await submitButton(page).click();
    await expect(formError(page)).toContainText("February 1990 has 28 days.");
    await expect(previewSvg(page)).toHaveCount(0);
  });

  test("out-of-range seconds are rejected and produce no preview", async ({ page }) => {
    await gotoApp(page);
    await page.locator("#full-name").fill("Kala Devi");
    await page.locator("#birth-date").selectOption("2");
    await page.locator("#birth-year").fill("1990");
    await page.locator("#birth-day").fill("14");
    await revealSeconds(page);
    await page.locator("#birth-seconds").fill("75");

    await expect(previewSvg(page)).toHaveCount(0);

    await submitButton(page).click();
    await expect(formError(page)).toContainText("Seconds must be between 0 and 59.");
    await expect(previewSvg(page)).toHaveCount(0);
  });

  test("a valid birth form is accepted and produces a preview", async ({ page }) => {
    await gotoApp(page);
    await page.locator("#full-name").fill("Kala Devi");
    await page.locator("#birth-date").selectOption("2");
    await page.locator("#birth-year").fill("1990");
    await page.locator("#birth-day").fill("14");
    await openManualEntry(page);
    await placeLabelInput(page).fill("Pune");
    const coords = coordinateInputs(page);
    await coords.nth(0).fill("18.5204");
    await coords.nth(1).fill("73.8567");
    await timezoneSelect(page).selectOption("Asia/Kolkata");

    await submitButton(page).click();
    await expect(previewSvg(page)).toHaveCount(1, { timeout: 20_000 });
    await expect(formError(page)).toHaveCount(0);
  });
});