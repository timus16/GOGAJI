/**
 * Font + PNG export helpers.
 * The PNG is rasterised from the very same SVG the preview shows, with the
 * fonts embedded as data URIs so an exported image can never fall back to
 * tofu — the Devanagari mantra is baked into the file, not fetched at view time.
 */
export const PHONE = { width: 1170, height: 2532 };
export const DESKTOP = { width: 2560, height: 1440 };

const FONT_FILES = {
  dev: "/fonts/noto-sans-devanagari-400.woff2",
  display: "/fonts/cinzel-latin.woff2",
} as const;

function toBase64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

let dataUriCache: { dev: string; display: string } | null = null;

/** Load the two webfonts once and return them as data URIs for embedding. */
export async function fontDataUris(): Promise<{ dev: string; display: string }> {
  if (dataUriCache) return dataUriCache;
  const [dev, display] = await Promise.all(
    [FONT_FILES.dev, FONT_FILES.display].map(async (f) => {
      const r = await fetch(f);
      if (!r.ok) throw new Error(`font ${f}: ${r.status}`);
      const buf = new Uint8Array(await r.arrayBuffer());
      return `data:font/woff2;base64,${toBase64(buf)}`;
    }),
  );
  dataUriCache = { dev, display };
  return dataUriCache;
}

/** @font-face rules pointing at the site's own font files (for the live preview). */
export const previewFontFaceCss = `
  @font-face{font-family:'Noto Sans Devanagari';src:url('${FONT_FILES.dev}') format('woff2');font-weight:400 700;font-display:block}
  @font-face{font-family:'Cinzel';src:url('${FONT_FILES.display}') format('woff2');font-weight:400 700;font-display:block}
`;

/** @font-face rules with the glyphs inline (for the exported PNG). */
export function embeddedFontFaceCss(u: { dev: string; display: string }): string {
  return `
  @font-face{font-family:'Noto Sans Devanagari';src:url('${u.dev}') format('woff2');font-weight:400 700}
  @font-face{font-family:'Cinzel';src:url('${u.display}') format('woff2');font-weight:400 700}
  `;
}

export async function svgToPngBlob(svg: string, width: number, height: number): Promise<Blob> {
  if (document.fonts?.ready) await document.fonts.ready;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.decoding = "sync";
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(img, 0, 0, width, height);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/png"));
    if (!blob) throw new Error("toBlob returned null");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
