// Searchable font dropdown with live per-option font rendering.
// Opening it (focus) shows the entire Google Fonts catalog minus whichever
// family is already applied; typing narrows it down. Webfonts are lazy-loaded
// via IntersectionObserver as each option scrolls into view within the panel
// (not all at once), so browsing the full ~1900-family list stays fast.

function createFontPicker(root, { initial = "", onChange } = {}) {
  const input = root.querySelector(".font-picker-input");
  const panel = root.querySelector(".font-picker-panel");
  let highlighted = -1;
  let currentMatches = [];
  let selectedValue = initial;

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        ensureFontLoaded(entry.target.dataset.font);
        observer.unobserve(entry.target);
      }
    }
  }, { root: panel });

  input.value = initial;

  function renderOptions(query) {
    observer.disconnect();
    const q = (query || "").trim().toLowerCase();
    const selLower = selectedValue.toLowerCase();
    currentMatches = GOOGLE_FONTS.filter((f) => {
      if (f.toLowerCase() === selLower) return false;
      return !q || f.toLowerCase().includes(q);
    });
    highlighted = -1;
    panel.innerHTML = "";
    for (const f of currentMatches) {
      const opt = document.createElement("div");
      opt.className = "font-option";
      opt.textContent = f;
      opt.dataset.font = f;
      opt.style.fontFamily = `'${f.replace(/'/g, "\\'")}', sans-serif`;
      opt.addEventListener("mousedown", (e) => {
        e.preventDefault(); // keep focus on input so blur doesn't close the panel first
        select(f);
      });
      panel.appendChild(opt);
      observer.observe(opt);
    }
    panel.hidden = currentMatches.length === 0;
  }

  function select(font) {
    selectedValue = font;
    input.value = font;
    panel.hidden = true;
    if (onChange) onChange(font);
  }

  function updateHighlight() {
    [...panel.children].forEach((el, i) => el.classList.toggle("hl", i === highlighted));
    const el = panel.children[highlighted];
    if (el) el.scrollIntoView({ block: "nearest" });
  }

  // On open: select all text (so typing replaces it) and browse the full list —
  // don't pre-filter by whatever's already applied. Bound to both focus (first
  // click, or tabbing in) and click (re-opening after a pick, since picking
  // doesn't blur the input, so a second click wouldn't otherwise re-fire focus).
  function openPanel() { input.select(); renderOptions(""); }
  input.addEventListener("focus", openPanel);
  input.addEventListener("click", () => { if (panel.hidden) openPanel(); });
  input.addEventListener("input", () => renderOptions(input.value));
  input.addEventListener("keydown", (e) => {
    if (panel.hidden) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlighted = Math.min(highlighted + 1, currentMatches.length - 1);
      updateHighlight();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlighted = Math.max(highlighted - 1, 0);
      updateHighlight();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted >= 0) select(currentMatches[highlighted]);
    } else if (e.key === "Escape") {
      panel.hidden = true;
    }
  });
  document.addEventListener("click", (e) => {
    if (!root.contains(e.target)) panel.hidden = true;
  });

  return {
    getValue: () => input.value,
    setValue: (v) => { input.value = v; selectedValue = v; },
  };
}
