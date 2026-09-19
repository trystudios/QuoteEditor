// Server-side port of app.js's canvas rendering: turns a QuoteMaker_V3
// recipe JSON into the final quote JPG, so the daily email doesn't depend
// on someone manually exporting a card in the browser first.
//
// Font loading mirrors fonts.js's approach (any Google Font + script-aware
// Noto Sans fallback) but downloads and registers real font files with
// @napi-rs/canvas instead of relying on the browser's own webfont/fallback
// handling.

const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");

// (start, end, Noto Sans suffix). null suffix = covered by plain "Noto Sans".
const SCRIPT_RANGES = [
  [0x0400, 0x04FF, null], [0x0370, 0x03FF, null],
  [0x0530, 0x058F, "Armenian"], [0x0590, 0x05FF, "Hebrew"],
  [0x0600, 0x06FF, "Arabic"], [0x0750, 0x077F, "Arabic"], [0x08A0, 0x08FF, "Arabic"],
  [0x0900, 0x097F, "Devanagari"], [0x0980, 0x09FF, "Bengali"],
  [0x0A00, 0x0A7F, "Gurmukhi"], [0x0A80, 0x0AFF, "Gujarati"],
  [0x0B00, 0x0B7F, "Oriya"], [0x0B80, 0x0BFF, "Tamil"],
  [0x0C00, 0x0C7F, "Telugu"], [0x0C80, 0x0CFF, "Kannada"],
  [0x0D00, 0x0D7F, "Malayalam"], [0x0D80, 0x0DFF, "Sinhala"],
  [0x0E00, 0x0E7F, "Thai"], [0x0E80, 0x0EFF, "Lao"],
  [0x1000, 0x109F, "Myanmar"], [0x10A0, 0x10FF, "Georgian"],
  [0x1200, 0x137F, "Ethiopic"], [0x1780, 0x17FF, "Khmer"],
  [0xAC00, 0xD7A3, "KR"], [0x1100, 0x11FF, "KR"],
  [0x3040, 0x30FF, "JP"], [0x4E00, 0x9FFF, "SC"],
];

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

// Registered-family cache, keyed "family::text" - warm serverless instances
// reuse this across invocations so repeat families/scripts skip the fetch.
const _registered = new Map();

async function ensureFontRegistered(family, text) {
  if (!family || !text) return false;
  const key = `${family}::${text}`;
  if (_registered.has(key)) return _registered.get(key);

  const promise = (async () => {
    try {
      const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;700&text=${encodeURIComponent(text)}`;
      const cssRes = await fetch(cssUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!cssRes.ok) return false;
      const css = await cssRes.text();
      const urls = [...css.matchAll(/src:\s*url\(([^)]+)\)\s*format\('(woff2|truetype)'\)/g)].map((m) => m[1]);
      if (!urls.length) return false;
      // One src per unicode-range block; register each so every needed glyph is covered.
      let any = false;
      for (const url of urls) {
        try {
          const fontRes = await fetch(url);
          if (!fontRes.ok) continue;
          const buf = Buffer.from(await fontRes.arrayBuffer());
          GlobalFonts.register(buf, family);
          any = true;
        } catch (e) { /* skip this subset */ }
      }
      return any;
    } catch (e) {
      return false;
    }
  })();

  _registered.set(key, promise);
  return promise;
}

async function buildFontStack(family, text) {
  const scripts = detectScripts(text || "");
  const fallbackFamilies = [...scripts].map((s) => (s === null ? "Noto Sans" : `Noto Sans ${s}`));
  const uniqueFallbacks = [...new Set(fallbackFamilies)];

  await Promise.all([
    ensureFontRegistered(family, text),
    ...uniqueFallbacks.map((f) => ensureFontRegistered(f, text)),
    ensureFontRegistered("Noto Sans", text),
  ]);

  const stack = [family, ...uniqueFallbacks, "Noto Sans", "sans-serif"]
    .filter(Boolean)
    .map((f) => `"${f.replace(/"/g, '\\"')}"`)
    .join(", ");
  return { stack };
}

function wrapLines(ctx, text, maxWidth) {
  const paragraphs = text.split("\n");
  const lines = [];
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    const words = trimmed.split(/\s+/);
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(test).width <= maxWidth || !cur) {
        cur = test;
      } else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
  }
  return lines.length ? lines : [text];
}

function drawShadowedText(ctx, text, x, y, color) {
  ctx.fillStyle = "#000000";
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

async function renderQuoteJpg(recipe) {
  const canvasW = recipe.width || 800;
  const canvasH = recipe.height || 533;
  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext("2d");

  const bgBuffer = Buffer.from(recipe.background_b64, "base64");
  const bgImage = await loadImage(bgBuffer);
  ctx.drawImage(bgImage, 0, 0, canvasW, canvasH);

  const q = recipe.quote || {};
  const a = recipe.attribution || {};
  const quoteText = q.text || "";
  const attrText = a.text || "- Prem Rawat";
  const quoteFamily = q.font_family || "Open Sans";
  const attrFamily = a.font_family || quoteFamily;
  const quoteSize = q.size || 38;
  const attrSize = a.size || 21;
  const quoteColor = q.color || "#ffffff";
  const attrColor = a.color || q.color || "#ffffff";

  const [qStack, aStack] = await Promise.all([
    buildFontStack(quoteFamily, quoteText),
    buildFontStack(attrFamily, attrText),
  ]);

  const maxWidth = canvasW * 0.86;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.font = `${quoteSize}px ${qStack.stack}`;
  const lines = wrapLines(ctx, quoteText, maxWidth);
  const lineHeight = quoteSize * 1.45;
  const attrHeight = attrSize * 1.4;
  const gap = 22;
  const quoteBlockHeight = lines.length * lineHeight;
  const blockTop = (canvasH - quoteBlockHeight - gap - attrHeight) / 2;

  let y = blockTop + quoteSize * 0.85;
  for (const line of lines) {
    drawShadowedText(ctx, line, canvasW / 2, y, quoteColor);
    y += lineHeight;
  }

  y += gap;
  ctx.font = `${attrSize}px ${aStack.stack}`;
  drawShadowedText(ctx, attrText, canvasW / 2, y + attrSize * 0.8, attrColor);

  return canvas.toBuffer("image/jpeg", 95);
}

module.exports = { renderQuoteJpg };
