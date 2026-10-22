import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const testResults: Record<string, { status: "PASS" | "FAIL"; evidence: string }> = {};

function recordResult(testName: string, passed: boolean, evidence: string) {
  testResults[testName] = { status: passed ? "PASS" : "FAIL", evidence };
  console.log(`[${passed ? "PASS" : "FAIL"}] ${testName}: ${evidence}`);
}

test.describe("GOGAJI Comprehensive QA", () => {
  test("Full E2E workflow", async ({ page }) => {
    await page.goto(BASE_URL);
    const nameInput = page.locator("input[name=\"name\"]");
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Priya Sharma");
    const nameValue = await nameInput.inputValue();
    recordResult("B6: Full name field", nameValue === "Priya Sharma", `Value: ${nameValue}`);
    const dateInput = page.locator("input[name=\"date\"]");
    await dateInput.fill("1955-03-15");
    const date1 = await dateInput.inputValue();
    await dateInput.fill("2020-06-10");
    const date2 = await dateInput.inputValue();
    recordResult("B7: Birth date range", date1 === "1955-03-15" && date2 === "2020-06-10", `1950s: ${date1}, 2020s: ${date2}`);
    const timeInput = page.locator("input[name=\"time\"]");
    await timeInput.fill("14:30:45");
    const timeValue = await timeInput.inputValue();
    recordResult("B8: Birth time with seconds", timeValue.includes("45"), `Time: ${timeValue}`);
    const latExists = (await page.locator("input[name=\"latitude\"]").count()) > 0;
    const lonExists = (await page.locator("input[name=\"longitude\"]").count()) > 0;
    recordResult("B10: Manual entry fields", latExists && lonExists, `Lat: ${latExists}, Lon: ${lonExists}`);
    const placeInput = page.locator("input[name=\"place\"]");
    await placeInput.fill("Mumbai");
    await page.waitForTimeout(1500);
    const mumbaiResult = page.locator("text=Mumbai").first();
    const citySearchWorks = await mumbaiResult.isVisible({ timeout: 3000 });
    if (citySearchWorks) {
      await mumbaiResult.click();
      await page.waitForTimeout(500);
    }
    recordResult("B11: City search Mumbai", citySearchWorks, `Results visible: ${citySearchWorks}`);
    const tzSelect = page.locator("select[name=\"timezone\"]");
    if (await tzSelect.isVisible({ timeout: 1000 })) {
      const options = await tzSelect.locator("option").allTextContents();
      const hasKolkata = options.some(o => o.includes("Kolkata"));
      const hasCalcutta = options.some(o => o.includes("Calcutta"));
      recordResult("B9: Timezone options", hasKolkata || hasCalcutta, `Kolkata: ${hasKolkata}, Calcutta: ${hasCalcutta}`);
      await tzSelect.selectOption({ label: /Kolkata|Calcutta/ });
    }
    await page.locator("button[type=\"submit\"]").click();
    await page.waitForTimeout(3000);
    const svg = page.locator("svg").first();
    const svgVisible = await svg.isVisible({ timeout: 5000 });
    recordResult("D15: SVG renders", svgVisible, `SVG visible: ${svgVisible}`);
    const pageContent = await page.textContent("body");
    const hasNakshatra = pageContent?.toLowerCase().includes("nakshatra") || false;
    recordResult("D16: Chart facts populate", hasNakshatra, `Nakshatra found: ${hasNakshatra}`);
    const errorBanner = page.locator("[class*=\"error\"], [role=\"alert\"]");
    const hasError = (await errorBanner.count()) > 0;
    recordResult("D18: No error banner", !hasError, `Error present: ${hasError}`);
    const phoneBtn = (await page.locator("button:has-text(\"Phone\")").count()) > 0;
    const desktopBtn = (await page.locator("button:has-text(\"Desktop\")").count()) > 0;
    recordResult("F24: Phone download", phoneBtn, `Button found: ${phoneBtn}`);
    recordResult("F25: Desktop download", desktopBtn, `Button found: ${desktopBtn}`);
  });
});
