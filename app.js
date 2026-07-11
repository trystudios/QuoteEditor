const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const cardsContainer = document.getElementById("cardsContainer");
const cardTemplate = document.getElementById("cardTemplate");
const toolbar = document.getElementById("toolbar");
const cardCountEl = document.getElementById("cardCount");

const cards = []; // controller objects: { el, exportJpg }

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

function loadRecipeFiles(fileList) {
  for (const file of fileList) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const recipe = JSON.parse(reader.result);
        const baseName = file.name.replace(/\.json$/i, "");
        cards.push(createCard(recipe, baseName));
        updateCount();
      } catch (e) {
        alert(`Couldn't read "${file.name}" as a recipe JSON: ${e.message}`);
      }
    };
    reader.readAsText(file);
  }
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
