// Any-Google-Font loading + script-aware fallback, mirroring QuoteMaker_V3/fonts.py
// but relying on the browser's native per-glyph font-stack fallback in canvas
// (no glyph-coverage inspection needed client-side — Chrome/Firefox/Safari all
// substitute within a comma-separated font-family stack the same way they do
// for regular DOM text).

// GOOGLE_FONTS (the full ~1942-family catalog) is defined in google-fonts-list.js,
// loaded before this file.

// (start, end, Noto Sans suffix). null suffix = covered by plain "Noto Sans".
const SCRIPT_RANGES = [
  [0x0400, 0x04FF, null],        // Cyrillic
  [0x0370, 0x03FF, null],        // Greek
  [0x0530, 0x058F, "Armenian"],
  [0x0590, 0x05FF, "Hebrew"],
  [0x0600, 0x06FF, "Arabic"],
  [0x0750, 0x077F, "Arabic"],
  [0x08A0, 0x08FF, "Arabic"],
  [0x0900, 0x097F, "Devanagari"],
  [0x0980, 0x09FF, "Bengali"],
  [0x0A00, 0x0A7F, "Gurmukhi"],
  [0x0A80, 0x0AFF, "Gujarati"],
  [0x0B00, 0x0B7F, "Oriya"],
  [0x0B80, 0x0BFF, "Tamil"],
  [0x0C00, 0x0C7F, "Telugu"],
  [0x0C80, 0x0CFF, "Kannada"],
  [0x0D00, 0x0D7F, "Malayalam"],
  [0x0D80, 0x0DFF, "Sinhala"],
  [0x0E00, 0x0E7F, "Thai"],
  [0x0E80, 0x0EFF, "Lao"],
  [0x1000, 0x109F, "Myanmar"],
  [0x10A0, 0x10FF, "Georgian"],
  [0x1200, 0x137F, "Ethiopic"],
  [0x1780, 0x17FF, "Khmer"],
  [0xAC00, 0xD7A3, "KR"],
  [0x1100, 0x11FF, "KR"],
  [0x3040, 0x30FF, "JP"],
  [0x4E00, 0x9FFF, "SC"],
];

// Return the set of Noto Sans suffixes needed to cover every script present in `text`.
// null in the set means plain "Noto Sans" (Latin/Cyrillic/Greek) is enough.
function detectScripts(text) {
  const found = new Set();
  for (const ch of text) {
    if (/\s/.test(ch) || /[\p{P}\p{S}]/u.test(ch)) continue;
    const cp = ch.codePointAt(0);
    for (const [start, end, suffix] of SCRIPT_RANGES) {
      if (cp >= start && cp <= end) { found.add(suffix); break; }
    }
  }
  return found;
}

const _injectedFonts = new Set();

function ensureFontLoaded(family) {
  if (!family || _injectedFonts.has(family)) return Promise.resolve();
  _injectedFonts.add(family);
  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;700&display=swap`;
    link.onload = () => resolve();
    link.onerror = () => resolve(); // don't block rendering on a bad font name
    document.head.appendChild(link);
  });
}

// Build a canvas-ready font-family stack for `text` set in `family`, loading
// whatever webfonts are needed (chosen family + any script-specific fallbacks).
async function buildFontStack(family, text) {
  const scripts = detectScripts(text || "");
  const fallbackFamilies = [...scripts].map(s => s === null ? "Noto Sans" : `Noto Sans ${s}`);
  const uniqueFallbacks = [...new Set(fallbackFamilies)];

  await Promise.all([
    ensureFontLoaded(family),
    ...uniqueFallbacks.map(ensureFontLoaded),
    ensureFontLoaded("Noto Sans"),
  ]);
  try { await document.fonts.ready; } catch (e) {}

  const stack = [family, ...uniqueFallbacks, "Noto Sans", "sans-serif"]
    .filter(Boolean)
    .map(f => `'${f.replace(/'/g, "\\'")}'`)
    .join(", ");
  // Only warn if the chosen family isn't itself already one of the needed
  // fallbacks (e.g. family is already "Noto Sans Devanagari" for Hindi text —
  // that's not a substitution, it's just the right font already selected).
  const familyLower = (family || "").toLowerCase();
  const usedFallback = uniqueFallbacks.length > 0 &&
    !uniqueFallbacks.some(f => f.toLowerCase() === familyLower);
  return { stack, usedFallback };
}
