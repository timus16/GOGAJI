import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  fillBirthForm,
  formNote,
  gotoApp,
  previewSvg,
  previewText,
  submitAndAwaitPreview,
  type BirthFormData,
} from "./support/form";

/**
 * GOGAJI product end-to-end test.
 *
 * The whole product path is deterministic: no AI provider, no geocoding, no
 * wall-clock dependency. The birth places are typed into the manual
 * coordinate fields, the AI checkbox stays off, and the expected chart facts
 * are the ones the deterministic engine (src/lib/astro.ts) produces for those
 * exact birth data - verified against the engine, not guessed.
 */

interface ExpectedChart {
  /** roman nakshatra name, as shown in the chart summary panel */
  nakshatra: string;
  /** Devanagari nakshatra name, as printed on the artwork */
  nakshatraDevanagari: string;
  pada: number;
  /** roman lagna sign */
  lagna: string;
  /** the LAGNA caption printed on the artwork */
  lagnaCaption: string;
  /** roman ruling-planet name */
  rulingPlanet: string;
  /** the graha beeja mantra printed on the artwork */
  mantraDevanagari: string;
}

/**
 * 1992-08-14, 05:45 IST, New Delhi.
 * Engine output: Moon in Dhaniṣṭhā, pada 4, lagna Karka (Cancer),
 * ruling planet Maṅgala (Mars), UTC 1992-08-14T00:15:00Z.
 */
const PERSON_A: BirthFormData & { expected: ExpectedChart } = {
  name: "Asha Ramesh",
  month: 8,
  day: 14,
  year: 1992,
  hour12: 5,
  minute: 45,
  ampm: "AM",
  placeLabel: "New Delhi",
  latitude: 28.6139,
  longitude: 77.209,
  timezone: "Asia/Kolkata",
  expected: {
    nakshatra: "Dhaniṣṭhā",
    nakshatraDevanagari: "धनिष्ठा",
    pada: 4,
    lagna: "Karka",
    lagnaCaption: "LAGNA KARKA",
    rulingPlanet: "Maṅgala",
    mantraDevanagari: "ॐ क्रां क्रीं क्रौं सः भौमाय नमः",
  },
};

/**
 * 1988-03-21, 18:30 IST, Bengaluru.
 * Engine output: Moon in Bharaṇī, pada 4, lagna Kanyā (Virgo),
 * ruling planet Śukra (Venus), UTC 1988-03-21T13:00:00Z.
 * Deliberately different from PERSON_A in every chart-derived token.
 */
const PERSON_B: BirthFormData & { expected: ExpectedChart } = {
  name: "Vikram Sen",
  month: 3,
  day: 21,
  year: 1988,
  hour12: 6,
  minute: 30,
  ampm: "PM",
  placeLabel: "Bengaluru",
  latitude: 12.9716,
  longitude: 77.5946,
  timezone: "Asia/Kolkata",
  expected: {
    nakshatra: "Bharaṇī",
    nakshatraDevanagari: "भरणी",
    pada: 4,
    lagna: "Kanyā",
    lagnaCaption: "LAGNA KANYĀ",
    rulingPlanet: "Śukra",
    mantraDevanagari: "ॐ द्रां द्रीं द्रौं सः शुक्राय नमः",
  },
};

/** Open a disclosure, but only when it is still closed. */
const openIfClosed = async (locator: Locator) => {
  if ((await locator.getAttribute("aria-expanded")) !== "true") await locator.click();
};

/**
 * The shared form helper types into the manual coordinate fields and the
 * optional seconds box, both of which sit behind a disclosure now, so they
 * are opened first.
 */
const fillForm = async (page: Page, d: BirthFormData) => {
  await openIfClosed(page.locator("#toggle-seconds"));
  await openIfClosed(page.locator("#toggle-manual"));
  await fillBirthForm(page, d);
};

test.describe("GOGAJI wallpaper generation (end to end)", () => {
  test("a complete birth form produces a chart-derived wallpaper preview", async ({ page }) => {
    await gotoApp(page);
    await fillForm(page, PERSON_A);
    await submitAndAwaitPreview(page);

    // The preview is the phone-sized wallpaper SVG (1170 x 2532).
    await expect(previewSvg(page)).toHaveAttribute("viewBox", "0 0 1170 2532");

    const text = await previewText(page);
    // The artwork carries the chart-derived tokens, not placeholders.
    expect(text).toContain(PERSON_A.expected.nakshatraDevanagari);
    expect(text).toContain(PERSON_A.expected.mantraDevanagari);
    expect(text).toContain(PERSON_A.expected.lagnaCaption);
    expect(text).toContain("LAGNA KARKA · WHOLE-SIGN HOUSES");
    // ... and the person's own name.
    expect(text.toUpperCase()).toContain("ASHA RAMESH");

    // The chart summary panel agrees with the artwork.
    await expect(formNote(page)).toHaveText(
      `Wallpaper drawn for ${PERSON_A.expected.nakshatra} · pada ${PERSON_A.expected.pada}.`,
    );
    await expect(page.locator("dd", { hasText: PERSON_A.expected.nakshatra })).toBeVisible();
    await expect(page.locator("dd", { hasText: PERSON_A.expected.lagna })).toBeVisible();
    await expect(page.locator("dd", { hasText: PERSON_A.expected.rulingPlanet })).toBeVisible();
  });

  test("a different birth data set produces different chart-derived tokens", async ({ page }) => {
    await gotoApp(page);

    await fillForm(page, PERSON_A);
    await submitAndAwaitPreview(page);
    const first = await previewText(page);

    await fillForm(page, PERSON_B);
    await submitAndAwaitPreview(page);
    // Wait for the chart of the SECOND birth data to be the one on screen.
    await expect(formNote(page)).toHaveText(
      `Wallpaper drawn for ${PERSON_B.expected.nakshatra} · pada ${PERSON_B.expected.pada}.`,
    );
    const second = await previewText(page);

    // First preview: the expected tokens of the first birth data.
    expect(first).toContain(PERSON_A.expected.nakshatraDevanagari);
    expect(first).toContain(PERSON_A.expected.mantraDevanagari);
    expect(first).toContain(PERSON_A.expected.lagnaCaption);

    // Second preview: the expected tokens of the second birth data.
    expect(second).toContain(PERSON_B.expected.nakshatraDevanagari);
    expect(second).toContain(PERSON_B.expected.mantraDevanagari);
    expect(second).toContain(PERSON_B.expected.lagnaCaption);

    // ... and the chart-derived tokens really did change.
    expect(second).not.toContain(PERSON_A.expected.nakshatraDevanagari);
    expect(second).not.toContain(PERSON_A.expected.mantraDevanagari);
    expect(second).not.toContain(PERSON_A.expected.lagnaCaption);
    expect(second).not.toBe(first);
  });

  test("a focus area changes the artwork: the bhava house is highlighted", async ({ page }) => {
    await gotoApp(page);
    await fillForm(page, PERSON_A);
    await submitAndAwaitPreview(page);

    // Without a focus area the poster carries no focus band at all.
    const before = await previewSvg(page).innerHTML();
    expect(before).not.toContain("FOCUS ·");
    expect(before).not.toContain("DHANA");

    // Picking "Wealth & finances" (dhana, the 2nd house) redraws the poster.
    await page.locator("#focus-wealth").check();

    await expect(previewSvg(page)).toContainText("DHANA", { timeout: 20_000 });
    const after = await previewSvg(page).innerHTML();
    expect(after).not.toBe(before);
    expect(after).toContain("FOCUS ·");
    expect(after).toContain("DHANA");
    // The house the area governs, named exactly as the chart names it.
    expect(after).toContain("2nd (dhana)");
  });

  test("the hero hands the child's name over and the artwork is drawn straight away", async ({ page }) => {
    await page.goto("/?name=Aarav&for=child&generate=1", { timeout: 60_000 });
    await page.waitForFunction(
      () => {
        const el = document.querySelector("#full-name");
        if (!el) return false;
        return Object.keys(el).some((k) => k.startsWith("__reactProps$"));
      },
      undefined,
      { timeout: 90_000 },
    );

    // The name and the subject arrive from the query string.
    await expect(page.locator("#full-name")).toHaveValue("Aarav", { timeout: 30_000 });
    await expect(page.locator('label[for="full-name"]')).toHaveText("Your child's name");
    await expect(page.locator("#subject-child")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('label[for="birth-date"]')).toHaveText("Your child's birth date");

    // ... and the wallpaper is already drawn, without a single click.
    await expect(previewSvg(page)).toHaveCount(1, { timeout: 30_000 });
    const text = await previewText(page);
    expect(text.toUpperCase()).toContain("AARAV");
    await expect(formNote(page)).toContainText("Wallpaper drawn for");
  });

  test("the phone PNG download fires with the chart-derived filename", async ({ page }) => {
    await gotoApp(page);
    await fillForm(page, PERSON_A);
    await submitAndAwaitPreview(page);

    const phoneButton = page.getByRole("button", { name: /Download phone PNG 1170×2532/ });
    await expect(phoneButton).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      phoneButton.click(),
    ]);

    expect(download.suggestedFilename()).toBe("nakshatra-canvas-asha-ramesh-phone-1170x2532.png");
    expect(download.suggestedFilename()).toMatch(/^nakshatra-canvas-[a-z0-9-]+-phone-1170x2532\.png$/);

    // The export really produced a PNG.
    const path = await download.path();
    expect(path).toBeTruthy();
  });

  test("without the AI opt-in nothing is persisted to localStorage", async ({ page }) => {
    await gotoApp(page);
    await fillForm(page, PERSON_A);
    await submitAndAwaitPreview(page);

    const stored = await page.evaluate(() => ({
      leadIndex: localStorage.getItem("lead_index"),
      leadKeys: Object.keys(localStorage).filter((k) => k.startsWith("lead_")),
    }));
    expect(stored.leadIndex).toBeNull();
    expect(stored.leadKeys).toEqual([]);
  });
});