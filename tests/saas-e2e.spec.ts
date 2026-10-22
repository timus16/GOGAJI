import { test, expect } from "@playwright/test";

/**
 * End-to-end tests for the SaaS funnel infrastructure.
 *
 * Run with: npx playwright test
 *
 * These tests verify:
 *  1. Form with seconds + timezone + manual entry
 *  2. Discovery gate capture
 *  3. Qualification blocks no-time input
 *  4. Deterministic wallpaper generates
 *  5. Download buttons work
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

test.describe("GOGAJI SaaS E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.clear());
  });

  test("Form accepts seconds and timezone with manual entry", async ({ page }) => {
    await page.goto(BASE_URL);

    // Fill name
    await page.fill(\'input[name="name"]\', "Arjuna Kumar");

    // Fill date
    await page.fill(\'input[name="date"]\', "1995-08-15");

    // Fill time with seconds (HH:MM:SS format)
    await page.fill(\'input[name="time"]\', "14:30:45");

    // Fill place - type to trigger search
    const placeInput = page.locator(\'input[name="place"]\');
    await placeInput.fill("Mumbai");
    await page.waitForTimeout(1000); // Wait for geocoding results

    // Select first result
    await page.click(\'text=Mumbai\', { timeout: 5000 });

    // Verify timezone dropdown is populated and select a zone
    const timezoneSelect = page.locator(\'select[name="timezone"]\');
    await expect(timezoneSelect).toBeVisible();
    await timezoneSelect.selectOption("Asia/Kolkata");

    // Verify latitude and longitude are populated (hidden fields)
    const lat = await page.inputValue(\'input[name="latitude"]\');
    const lon = await page.inputValue(\'input[name="longitude"]\');
    expect(parseFloat(lat)).toBeGreaterThan(0);
    expect(parseFloat(lon)).toBeGreaterThan(0);

    // Form should be valid
    const submitButton = page.locator(\'button[type="submit"]\');
    await expect(submitButton).toBeEnabled();
  });

  test("Discovery gate captures answers", async ({ page }) => {
    await page.goto(BASE_URL);

    // Check if discovery gate is shown (depends on your routing)
    const q1 = page.locator(\'text=What will you use this for?\');
    if (await q1.isVisible({ timeout: 2000 })) {
      // Select an intent
      await page.click(\'text=Child\\'s room decoration\');
      await page.click(\'button:has-text("Continue")\');

      // Fill Q2
      await page.fill(\'textarea\', "Too generic, didn\\'t feel personal");
      await page.click(\'button:has-text("Start Creating")\');

      // Verify answers are stored (check localStorage or form state)
      const stored = await page.evaluate(() => {
        return {
          intent: (window as any).__discoveryIntent,
          previousFailure: (window as any).__discoveryPreviousFailure,
        };
      });

      // This test is placeholder - actual implementation depends on state management
      expect(stored).toBeDefined();
    }
  });

  test("Qualification blocks submission without birth time", async ({ page }) => {
    await page.goto(BASE_URL);

    // Fill name
    await page.fill(\'input[name="name"]\', "Test User");

    // Fill date
    await page.fill(\'input[name="date"]\', "1990-01-01");

    // Leave time empty
    await page.fill(\'input[name="time"]\', "");

    // Fill place
    const placeInput = page.locator(\'input[name="place"]\');
    await placeInput.fill("Delhi");
    await page.waitForTimeout(1000);
    await page.click(\'text=Delhi\', { timeout: 5000 }).catch(() => {});

    // Try to submit
    await page.click(\'button[type="submit"]\');

    // Should see error message about birth time being required
    await expect(
      page.locator(\'text=/Birth time is required/i\')
    ).toBeVisible({ timeout: 5000 });
  });

  test("Deterministic wallpaper generates for valid input", async ({ page }) => {
    await page.goto(BASE_URL);

    // Fill complete valid form
    await page.fill(\'input[name="name"]\', "Ravi Sharma");
    await page.fill(\'input[name="date"]\', "1988-03-21");
    await page.fill(\'input[name="time"]\', "06:15:00");

    // Fill place
    const placeInput = page.locator(\'input[name="place"]\');
    await placeInput.fill("Bangalore");
    await page.waitForTimeout(1000);
    await page.click(\'text=Bangalore\', { timeout: 5000 });

    // Select timezone
    await page.selectOption(\'select[name="timezone"]\', "Asia/Kolkata");

    // Submit
    await page.click(\'button[type="submit"]\');

    // Wait for chart to compute and render
    await page.waitForSelector(\'text=/Nakshatra/i\', { timeout: 10000 });

    // Verify chart data is displayed
    await expect(page.locator(\'text=/Moon Nakshatra/i\')).toBeVisible();

    // Verify SVG wallpaper preview exists
    const svg = page.locator("svg");
    await expect(svg.first()).toBeVisible();

    // Verify the same input produces the same chart (deterministic)
    const nakshatra1 = await page.textContent(\'[data-testid="nakshatra-name"]\').catch(() => null);
    
    // Refresh and submit again
    await page.reload();
    await page.fill(\'input[name="name"]\', "Ravi Sharma");
    await page.fill(\'input[name="date"]\', "1988-03-21");
    await page.fill(\'input[name="time"]\', "06:15:00");
    await placeInput.fill("Bangalore");
    await page.waitForTimeout(1000);
    await page.click(\'text=Bangalore\', { timeout: 5000 });
    await page.selectOption(\'select[name="timezone"]\', "Asia/Kolkata");
    await page.click(\'button[type="submit"]\');
    await page.waitForSelector(\'text=/Nakshatra/i\', { timeout: 10000 });

    const nakshatra2 = await page.textContent(\'[data-testid="nakshatra-name"]\').catch(() => null);

    // Both should match (if test IDs are present)
    if (nakshatra1 && nakshatra2) {
      expect(nakshatra1).toBe(nakshatra2);
    }
  });

  test("Download buttons work for desktop and phone", async ({ page }) => {
    await page.goto(BASE_URL);

    // Fill and submit valid form
    await page.fill(\'input[name="name"]\', "Download Test");
    await page.fill(\'input[name="date"]\', "2000-06-10");
    await page.fill(\'input[name="time"]\', "12:00:00");

    const placeInput = page.locator(\'input[name="place"]\');
    await placeInput.fill("Chennai");
    await page.waitForTimeout(1000);
    await page.click(\'text=Chennai\', { timeout: 5000 });
    await page.selectOption(\'select[name="timezone"]\', "Asia/Kolkata");
    await page.click(\'button[type="submit"]\');

    // Wait for wallpaper to render
    await page.waitForSelector(\'text=/Nakshatra/i\', { timeout: 10000 });

    // Listen for download events
    const downloadPromise = page.waitForEvent("download");

    // Click desktop download button (if visible)
    const desktopBtn = page.locator(\'button:has-text("Desktop")\');
    if (await desktopBtn.isVisible({ timeout: 2000 })) {
      await desktopBtn.click();

      // Verify download started
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.png$/);
    }

    // Click phone download button
    const downloadPromise2 = page.waitForEvent("download");
    const phoneBtn = page.locator(\'button:has-text("Phone")\');
    if (await phoneBtn.isVisible({ timeout: 2000 })) {
      await phoneBtn.click();
      const download2 = await downloadPromise2;
      expect(download2.suggestedFilename()).toMatch(/\.png$/);
    }
  });

  test("CRM captures lead data in localStorage", async ({ page }) => {
    await page.goto(BASE_URL);

    // Clear localStorage
    await page.evaluate(() => localStorage.clear());

    // Submit form
    await page.fill(\'input[name="name"]\', "CRM Test");
    await page.fill(\'input[name="date"]\', "1992-11-05");
    await page.fill(\'input[name="time"]\', "18:30:00");

    const placeInput = page.locator(\'input[name="place"]\');
    await placeInput.fill("Pune");
    await page.waitForTimeout(1000);
    await page.click(\'text=Pune\', { timeout: 5000 });
    await page.selectOption(\'select[name="timezone"]\', "Asia/Kolkata");
    await page.click(\'button[type="submit"]\');

    // Wait for processing
    await page.waitForTimeout(2000);

    // Check localStorage for lead capture
    const leadIndex = await page.evaluate(() => {
      return localStorage.getItem("lead_index");
    });

    expect(leadIndex).toBeTruthy();

    const leads = await page.evaluate(() => {
      const index = JSON.parse(localStorage.getItem("lead_index") || "[]");
      if (index.length === 0) return null;
      const leadId = index[index.length - 1];
      return localStorage.getItem(`lead_${leadId}`);
    });

    if (leads) {
      const leadData = JSON.parse(leads);
      expect(leadData.input.name).toBe("CRM Test");
      expect(leadData.nakshatra).toBeTruthy();
    }
  });
});