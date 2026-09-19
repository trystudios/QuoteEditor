const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const cardsContainer = document.getElementById("cardsContainer");
const cardTemplate = document.getElementById("cardTemplate");
const toolbar = document.getElementById("toolbar");
const cardCountEl = document.getElementById("cardCount");
const weekTabsEl = document.getElementById("weekTabs");
const weekEmptyEl = document.getElementById("weekEmpty");

const cards = []; // controller objects: { el, exportJpg, source: 'manual'|'week', weekStart? }

// ── Text wrapping (pixel-accurate, using the real font) ──────────────────
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

function setFallbackNote(el, show, family) {
  if (show && !el.dataset.template) el.dataset.template = el.textContent;
  if (el.dataset.template) el.textContent = el.dataset.template.replace("{{FIELD}}", family);
  el.classList.toggle("show", show);
}

function updateCount() {
  cardCountEl.textContent = cards.length === 1 ? "1 card" : `${cards.length} cards`;
  toolbar.hidden = cards.length === 0;
}

// ── One card's controller: its own DOM, its own state, its own render loop ──
function createCard(recipe, baseName) {
  const el = cardTemplate.content.firstElementChild.cloneNode(true);
  cardsContainer.appendChild(el);

  const canvas = el.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  el.querySelector(".card-filename").textContent = baseName;

  const fields = {
    quoteText: el.querySelector(".quoteText"),
    quoteSize: el.querySelector(".quoteSize"),
    quoteSizeVal: el.querySelector(".quoteSizeVal"),
    quoteColor: el.querySelector(".quoteColor"),
    quoteFallback: el.querySelector(".quoteFallback"),
    attrText: el.querySelector(".attrText"),
    attrSize: el.querySelector(".attrSize"),
    attrSizeVal: el.querySelector(".attrSizeVal"),
    attrColor: el.querySelector(".attrColor"),
    attrFallback: el.querySelector(".attrFallback"),
  };
  const quoteFontPicker = createFontPicker(el.querySelector(".quoteFont"), { onChange: () => scheduleRender() });
  const attrFontPicker = createFontPicker(el.querySelector(".attrFont"), { onChange: () => scheduleRender() });

  let bgImage = null;
  let canvasW = recipe.width || 800;
  let canvasH = recipe.height || 533;
  let renderToken = 0;

  function syncSizeLabels() {
    fields.quoteSizeVal.textContent = fields.quoteSize.value + "px";
    fields.attrSizeVal.textContent = fields.attrSize.value + "px";
  }

  async function render() {
    const token = ++renderToken;
    if (!bgImage) return;

    const quoteText = fields.quoteText.value;
    const attrText = fields.attrText.value;
    const quoteFamily = quoteFontPicker.getValue().trim() || "Open Sans";
    const attrFamily = attrFontPicker.getValue().trim() || quoteFamily;
    const quoteSize = parseInt(fields.quoteSize.value, 10);
    const attrSize = parseInt(fields.attrSize.value, 10);
    const quoteColor = fields.quoteColor.value;
    const attrColor = fields.attrColor.value;

    const [qStack, aStack] = await Promise.all([
      buildFontStack(quoteFamily, quoteText),
      buildFontStack(attrFamily, attrText),
    ]);
    if (token !== renderToken) return; // a newer render superseded this one

    setFallbackNote(fields.quoteFallback, qStack.usedFallback, quoteFamily);
    setFallbackNote(fields.attrFallback, aStack.usedFallback, attrFamily);

    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.drawImage(bgImage, 0, 0, canvasW, canvasH);

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
  }

  let debounceTimer = null;
  function scheduleRender() {
    syncSizeLabels();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(render, 150);
  }

  for (const key of ["quoteText", "quoteSize", "quoteColor", "attrText", "attrSize", "attrColor"]) {
    fields[key].addEventListener("input", scheduleRender);
    fields[key].addEventListener("change", scheduleRender);
  }

  function exportJpg() {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/jpeg", 0.95);
  }

  el.querySelector(".export-btn").addEventListener("click", exportJpg);
  el.querySelector(".remove-btn").addEventListener("click", () => {
    el.remove();
    const idx = cards.findIndex((c) => c.el === el);
    if (idx !== -1) cards.splice(idx, 1);
    updateCount();
  });

  canvas.width = canvasW;
  canvas.height = canvasH;
  bgImage = new Image();
  bgImage.onload = () => {
    const q = recipe.quote || {};
    const a = recipe.attribution || {};
    fields.quoteText.value = q.text || "";
    quoteFontPicker.setValue(q.font_family || "Open Sans");
    fields.quoteSize.value = q.size || 38;
    fields.quoteColor.value = q.color || "#ffffff";
    fields.attrText.value = a.text || "- Prem Rawat";
    attrFontPicker.setValue(a.font_family || q.font_family || "Open Sans");
    fields.attrSize.value = a.size || 21;
    fields.attrColor.value = a.color || q.color || "#ffffff";
    syncSizeLabels();
    render();
  };
  bgImage.src = `data:image/jpeg;base64,${recipe.background_b64}`;

  return { el, exportJpg };
}

function readFileAsText(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsText(file);
  });
}

// Reads every dropped file before creating any cards, so cards always
// appear sorted by their "<Mon> <day>" name regardless of the order the
// browser happens to finish reading them in.
async function loadRecipeFiles(fileList) {
  // Snapshot immediately (synchronously) - `fileList` can be the input's
  // live FileList, which the caller may clear (input.value = "") right
  // after calling this, before our awaited reads below finish.
  const files = Array.from(fileList);
  const parsed = [];
  for (const file of files) {
    const text = await readFileAsText(file);
    const baseName = file.name.replace(/\.json$/i, "");
    try {
      parsed.push({ baseName, recipe: JSON.parse(text) });
    } catch (e) {
      alert(`Couldn't read "${file.name}" as a recipe JSON: ${e.message}`);
    }
  }
  sortByDateName(parsed, (p) => p.baseName);
  for (const { baseName, recipe } of parsed) {
    cards.push({ ...createCard(recipe, baseName), source: "manual" });
  }
  updateCount();
}

// ── Week tabs: previous week, current/upcoming week (default), next 2 weeks ─
let weekIndex = [];       // [{weekStart, url, fileCount}] from /api/weeks
let activeWeekStart = null;
const weekFileCache = {}; // weekStart -> files array, fetched lazily per tab

function computeTabWeeks() {
  const current = currentOrUpcomingMonday();
  return [-7, 0, 7, 14].map((offset) => isoDate(addDays(current, offset)));
}

function renderTabs(tabWeeks) {
  weekTabsEl.innerHTML = "";
  for (const weekStart of tabWeeks) {
    const entry = weekIndex.find((w) => w.weekStart === weekStart);
    const btn = document.createElement("button");
    btn.className = "week-tab" + (weekStart === activeWeekStart ? " active" : "") + (!entry ? " empty" : "");
    btn.textContent = weekLabel(weekStart);
    btn.addEventListener("click", () => selectWeek(weekStart, tabWeeks));
    weekTabsEl.appendChild(btn);
  }
}

function removeWeekCards() {
  for (let i = cards.length - 1; i >= 0; i--) {
    if (cards[i].source === "week") {
      cards[i].el.remove();
      cards.splice(i, 1);
    }
  }
}

async function selectWeek(weekStart, tabWeeks) {
  activeWeekStart = weekStart;
  renderTabs(tabWeeks);
  removeWeekCards();

  const entry = weekIndex.find((w) => w.weekStart === weekStart);
  if (!entry) {
    weekEmptyEl.hidden = false;
    updateCount();
    return;
  }
  weekEmptyEl.hidden = true;

  try {
    if (!weekFileCache[weekStart]) {
      // Cache-bust: Blob's CDN caches this URL's content for up to a minute
      // after an upload/delete, since the pathname is reused on overwrite.
      const res = await fetch(`${entry.url}?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      weekFileCache[weekStart] = Array.isArray(data.files) ? data.files : [];
      sortByDateName(weekFileCache[weekStart]);
    }
    for (const f of weekFileCache[weekStart]) {
      cards.push({ ...createCard(f.recipe, f.name), source: "week", weekStart });
    }
  } catch (e) {
    console.error("Failed to load week", weekStart, e);
  }
  updateCount();
}

async function initWeekTabs() {
  const tabWeeks = computeTabWeeks();
  try {
    const res = await fetch("/api/weeks");
    const data = await res.json();
    weekIndex = Array.isArray(data.weeks) ? data.weeks : [];
  } catch (e) {
    weekIndex = []; // e.g. running locally without the /api functions
  }
  renderTabs(tabWeeks);
  await selectWeek(tabWeeks[1], tabWeeks); // 2nd tab = current/upcoming week
}

// ── Wiring (page-level) ────────────────────────────────────────────────────
fileInput.addEventListener("change", () => {
  if (fileInput.files.length) loadRecipeFiles(fileInput.files);
  fileInput.value = "";
});
dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("drag"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("drag");
  if (e.dataTransfer.files.length) loadRecipeFiles(e.dataTransfer.files);
});

document.getElementById("exportAllBtn").addEventListener("click", () => {
  cards.forEach((c, i) => setTimeout(() => c.exportJpg(), i * 150));
});
document.getElementById("clearAllBtn").addEventListener("click", () => {
  cards.forEach((c) => c.el.remove());
  cards.length = 0;
  updateCount();
});

initWeekTabs();
