import { expect, test } from "@playwright/test";
import { computeChart, rashiOf, type BirthInput } from "../src/lib/astro";
import { buildWallpaperSvg } from "../src/lib/wallpaper";

/**
 * Contract tests for the deterministic core of GOGAJI.
 *
 * These need NO browser and NO wall clock: the chart engine is a pure
 * function of the birth data, and the renderer is a pure function of the
 * chart. The only server interaction is the SSR document check, which uses
 * the API request context (no browser page is launched for it).
 */

/**
 * A fixed, well-known birth data set:
 * 1992-08-14, 05:45 local, New Delhi (28.6139 N, 77.209 E), Asia/Kolkata.
 */
const FIXED_BIRTH: BirthInput = {
  name: "Asha Ramesh",
  date: "1992-08-14",
  time: "05:45",
  place: "New Delhi",
  latitude: 28.6139,
  longitude: 77.209,
  timezone: "Asia/Kolkata",
};

const PRESET_IDS = ["temple-gold", "indigo-midnight", "minimal-line", "dense-mandala"];

test.describe("GOGAJI deterministic core", () => {
  test("the SSR document is served and carries the app title", async ({ request }) => {
    const response = await request.get("/");
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("Nakshatra Canvas");
    expect(html).toContain("your kundli as wallpaper");
  });

  test("computeChart returns the expected nakshatra, pada, lagna and ruling planet", () => {
    const chart = computeChart(FIXED_BIRTH);

    // Moon nakshatra and pada.
    expect(chart.moonNakshatra.name).toBe("Dhaniṣṭhā");
    expect(chart.moonNakshatra.devanagari).toBe("धनिष्ठा");
    expect(chart.moonPada).toBe(4);
    expect(chart.syllable.devanagari).toBe("गे");

    // Lagna sign.
    expect(rashiOf(chart.lagna.signIndex).name).toBe("Karka");
    expect(rashiOf(chart.lagna.signIndex).english).toBe("Cancer");
    expect(chart.lagna.degreeInSign).toBeCloseTo(25.838, 3);

    // Ruling planet (the nakshatra lord).
    expect(chart.rulingPlanet).toBe("mars");

    // The resolved instant and the zone offset.
    expect(chart.utc.toISOString()).toBe("1992-08-14T00:15:00.000Z");
    expect(chart.offsetMinutes).toBe(330);

    // A second call with the same input is identical.
    const again = computeChart(FIXED_BIRTH);
    expect(again.moonNakshatra.name).toBe(chart.moonNakshatra.name);
    expect(again.lagna.signIndex).toBe(chart.lagna.signIndex);
    expect(again.rulingPlanet).toBe(chart.rulingPlanet);
  });

  test("a different birth data set yields a different chart", () => {
    const chart = computeChart({
      name: "Vikram Sen",
      date: "1988-03-21",
      time: "18:30",
      place: "Bengaluru",
      latitude: 12.9716,
      longitude: 77.5946,
      timezone: "Asia/Kolkata",
    });
    expect(chart.moonNakshatra.name).toBe("Bharaṇī");
    expect(chart.moonNakshatra.devanagari).toBe("भरणी");
    expect(chart.moonPada).toBe(4);
    expect(rashiOf(chart.lagna.signIndex).name).toBe("Kanyā");
    expect(chart.rulingPlanet).toBe("venus");
    expect(chart.utc.toISOString()).toBe("1988-03-21T13:00:00.000Z");
  });

  test("buildWallpaperSvg renders four distinct presets with the chart-derived tokens", () => {
    const chart = computeChart(FIXED_BIRTH);
    const svgs = PRESET_IDS.map((presetId) =>
      buildWallpaperSvg({ chart, presetId, width: 1170, height: 2532, fontFaceCss: "" }),
    );

    // Four preset ids must give four different documents.
    expect(svgs).toHaveLength(4);
    expect(new Set(svgs).size).toBe(4);

    for (const svg of svgs) {
      // The wallpaper carries the chart facts, not placeholders.
      expect(svg).toContain('viewBox="0 0 1170 2532"');
      expect(svg).toContain("धनिष्ठा");
      expect(svg).toContain("ॐ क्रां क्रीं क्रौं सः भौमाय नमः");
      expect(svg).toContain("LAGNA KARKA");
      expect(svg).toContain("LAGNA KARKA · WHOLE-SIGN HOUSES");
      // The person's own name is printed on the artwork.
      expect(svg.toUpperCase()).toContain("ASHA RAMESH");
    }
  });

  test("an unknown preset id falls back to the default preset instead of failing", () => {
    const chart = computeChart(FIXED_BIRTH);
    const fallback = buildWallpaperSvg({
      chart,
      presetId: "not-a-real-preset",
      width: 1170,
      height: 2532,
      fontFaceCss: "",
    });
    const templeGold = buildWallpaperSvg({
      chart,
      presetId: "temple-gold",
      width: 1170,
      height: 2532,
      fontFaceCss: "",
    });
    expect(fallback).toBe(templeGold);
  });
});