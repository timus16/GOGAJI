import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Shared helpers for the GOGAJI end-to-end specs.
 *
 * Everything here is deterministic and network-free: the birth place is typed
 * into the manual-coordinate fields (never geocoded), the discovery gate is
 * pre-seeded in localStorage, and the AI step is never enabled.
 */

/** The one birth-data shape the manual form can express. */
export interface BirthFormData {
  name: string;
  /** 1..12 */
  month: number;
  day: number;
  year: number;
  /** 1..12, 12-hour clock */
  hour12: number;
  /** 0..59 */
  minute: number;
  ampm: "AM" | "PM";
  /** left empty when the birth time has no seconds */
  seconds?: string;
  placeLabel: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

/**
 * Pre-seed the "discovery gate already answered" flag BEFORE any page script
 * runs, so the gate never renders. Seeding through an init script (instead of
 * clicking Skip) removes the race between the gate mounting and the test
 * interacting with the form.
 */
export const seedDiscoveryDone = async (context: { addInitScript: (fn: () => void) => Promise<void> }) => {
  await context.addInitScript(() => {
    try {
      localStorage.setItem("gogaji.discoveryDone", "1");
    } catch {
      /* storage blocked: the gate would still be skippable by click */
    }
  });
};

/**
 * Wait until React has hydrated the page.
 *
 * The dev server compiles the client module graph lazily, so on a cold cache
 * the first page load can return its server-rendered HTML several seconds
 * before the React bundle is evaluated. Typing into a controlled input before
 * hydration is silently thrown away, so every spec waits for hydration
 * first. React marks every hydrated host element with a `__reactProps$` key.
 */
export const waitForHydration = async (page: Page) => {
  await page.waitForFunction(
    () => {
      const el = document.querySelector("#full-name");
      if (!el) return false;
      return Object.keys(el).some((k) => k.startsWith("__reactProps$"));
    },
    undefined,
    { timeout: 90_000 },
  );
};

/** Open the app and wait until it is interactive. */
export const gotoApp = async (page: Page) => {
  await page.goto("/", { timeout: 60_000 });
  await waitForHydration(page);
};

/** The city geocoding input (never used for its network search in tests). */
export const cityInput = (page: Page) => page.locator('input[placeholder="City, e.g. New Delhi"]');

/** The manual "Place label" input. */
export const placeLabelInput = (page: Page) => page.locator('input[class*="col-span-2"]');

/** The manual latitude / longitude number inputs. */
export const coordinateInputs = (page: Page) => page.locator('input[type="number"][step="any"]');

/** The IANA timezone <select> (the one that carries an Asia/Kolkata option). */
export const timezoneSelect = (page: Page) =>
  page.locator("select").filter({ has: page.locator('option[value="Asia/Kolkata"]') });

/** The AM/PM button group. */
export const ampmGroup = (page: Page) => page.locator('div[role="group"][aria-label="AM or PM"]');

/** The submit button of the birth form. */
export const submitButton = (page: Page) => page.locator('button[type="submit"]');

/** The rendered wallpaper preview (the inline phone-sized SVG). */
export const previewSvg = (page: Page): Locator => page.locator('svg[viewBox="0 0 1170 2532"]');

/** The inline validation error rendered under the submit button. */
export const formError = (page: Page): Locator => page.locator("form p.text-red-200");

/** The inline date error rendered under the birth-date grid. */
export const dateError = (page: Page): Locator => page.locator("p.text-red-300");

/** The inline success note rendered under the submit button. */
export const formNote = (page: Page): Locator => page.locator("form p.text-emerald-200");

/** The 24h time the form composes out of the 12h clock + AM/PM + seconds. */
export const composedTime = (d: BirthFormData): string => {
  const hour24 = (d.hour12 % 12) + (d.ampm === "PM" ? 12 : 0);
  const hh = String(hour24).padStart(2, "0");
  const mm = String(d.minute).padStart(2, "0");
  return d.seconds ? `${hh}:${mm}:${d.seconds.padStart(2, "0")}` : `${hh}:${mm}`;
};

/** Fill the whole birth form from typed data. No network call is made. */
export const fillBirthForm = async (page: Page, d: BirthFormData) => {
  await page.locator("#full-name").fill(d.name);
  await page.locator("#birth-date").selectOption(String(d.month));
  await page.locator("#birth-day").fill(String(d.day));
  await page.locator("#birth-year").fill(String(d.year));
  await page.locator("#birth-time").selectOption(String(d.hour12));
  await page.locator("#birth-minute").selectOption(String(d.minute));
  await page.locator("#birth-seconds").fill(d.seconds ?? "");
  await ampmGroup(page).getByRole("button", { name: d.ampm, exact: true }).click();
  await cityInput(page).fill(d.placeLabel);
  await placeLabelInput(page).fill(d.placeLabel);
  const coords = coordinateInputs(page);
  await coords.nth(0).fill(String(d.latitude));
  await coords.nth(1).fill(String(d.longitude));
  await timezoneSelect(page).selectOption(d.timezone);

  // The form re-renders the composed 24h time out of its own state, so this
  // proves the typed values really reached the application.
  const timeLine = page.locator("p", { hasText: "Sent as 24h" });
  await expect(timeLine).toContainText(composedTime(d));
  await expect(timeLine).toContainText(d.timezone);
  await expect(page.locator("#full-name")).toHaveValue(d.name);
};

/** Submit the form and wait for the wallpaper preview to be rendered. */
export const submitAndAwaitPreview = async (page: Page) => {
  await submitButton(page).click();
  await expect(previewSvg(page)).toHaveCount(1, { timeout: 30_000 });
  await expect(previewSvg(page)).toBeVisible();
  return previewSvg(page);
};

/** The concatenated text of every <text> node inside the preview SVG. */
export const previewText = async (page: Page): Promise<string> => {
  const text = await previewSvg(page).textContent();
  return text ?? "";
};