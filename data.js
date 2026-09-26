const passwordEl = document.getElementById("password");
const weekStartEl = document.getElementById("weekStart");
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const selectedFilesEl = document.getElementById("selectedFiles");
const uploadBtn = document.getElementById("uploadBtn");
const uploadMsgEl = document.getElementById("uploadMsg");
const storedListEl = document.getElementById("storedList");
const sameLinkAllDaysEl = document.getElementById("sameLinkAllDays");
const unchangeLinksEl = document.getElementById("unchangeLinks");
const jpgDropzone = document.getElementById("jpgDropzone");
const jpgFileInput = document.getElementById("jpgFileInput");
const selectedJpgsEl = document.getElementById("selectedJpgs");
const recipientsEl = document.getElementById("recipients");

// Same default list lib/recipients.js falls back to for weeks uploaded
// before this field existed - kept in sync manually (small, rarely edited).
const DEFAULT_RECIPIENTS_TEXT = "anita jagodzinska <marianita.j@wp.pl>, hsing211 <hsing211@yahoo.com.tw>, Jean-Pierre PHILIPPE <jeanpierrephi@gmail.com>, Rajesh Rathod <rajeshnrathod@gmail.com>, Peter Boiu German Quotes <peter-boiu@gmx.de>, Lobo Gmail <tovoheryrazaka@gmail.com>, Marc G <ararasgrimberg@gmail.com>, Lobo Razakamanana <loborazaka@hotmail.com>, Rafal <rafalewski@gmail.com>, Viviane Vohangy Ratsisetraina <viviane.ratsisetraina@yahoo.fr>, Géraldi <tag_antonello@hotmail.com>, Carlos Saraiva <carlos.c.saraiva@gmail.com>, Delia Ortega <palabrasdepaz4@gmail.com>, Sergio Pereira <marzollini@msn.com>, Giorgos Dimitriou <drgiorgis@rocketmail.com>, Tiki regwun <regwuntiki@gmail.com>, Jean-Luc MARÉCHAL <jelumar00@gmail.com>, Julio Perez <juliodemenezespinto91@gmail.com>, Michael Dorfman <mdorfman7@gmail.com>, Umul choironi - Bahasa Indonesia <shidra12@gmail.com>, Ziga Valetic Slovenian Quotes <ziga.valetic@gmail.com>, Bahaa Zahnan <zahnanb@gmail.com>";

async function loadRecipientsForWeek(weekStart) {
  recipientsEl.value = "Loading…";
  try {
    const res = await fetch("/api/weeks?counts=1");
    const data = await res.json();
    const entry = (data.weeks || []).find((w) => w.weekStart === weekStart);
    if (entry && entry.url) {
      const weekRes = await fetch(`${entry.url}?t=${Date.now()}`, { cache: "no-store" });
      if (weekRes.ok) {
        const week = await weekRes.json();
        if (typeof week.recipients === "string" && week.recipients.trim()) {
          recipientsEl.value = week.recipients;
          return;
        }
      }
    }
  } catch (e) {
    // fall through to default below
  }
  recipientsEl.value = DEFAULT_RECIPIENTS_TEXT;
}

let selectedFiles = []; // [{name, recipe}]
let selectedJpgs = []; // [{name, base64}] - name matched against selectedFiles' name

// ── Per-day "Un-change" YouTube link fields (Mon-Fri of the selected week) ──
function weekdayDates(weekStartIso) {
  const monday = new Date(weekStartIso + "T00:00:00");
  return [0, 1, 2, 3, 4].map((n) => isoDate(addDays(monday, n)));
}

function renderUnchangeInputs() {
  const dates = weekdayDates(weekStartEl.value);
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const prevUrls = Array.from(unchangeLinksEl.querySelectorAll("input[data-date]"))
    .reduce((m, el) => { m[el.dataset.date] = el.value; return m; }, {});
  const prevTitles = Array.from(unchangeLinksEl.querySelectorAll("input[data-title-date]"))
    .reduce((m, el) => { m[el.dataset.titleDate] = el.value; return m; }, {});

  unchangeLinksEl.innerHTML = "";
  dates.forEach((date, i) => {
    const row = document.createElement("div");
    row.className = "unchange-link-row";
    row.style.margin = "10px 0";

    const label = document.createElement("span");
    label.className = "day-label";
    label.textContent = `${dayNames[i]} (${date})`;

    const input = document.createElement("input");
    input.type = "url";
    input.placeholder = "https://www.youtube.com/watch?v=...";
    input.dataset.date = date;
    input.value = prevUrls[date] || "";

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.placeholder = "Link text (auto-filled from video title)";
    titleInput.dataset.titleDate = date;
    titleInput.value = prevTitles[date] || "";

    row.appendChild(label);
    row.appendChild(input);
    row.appendChild(titleInput);
    unchangeLinksEl.appendChild(row);
  });

  unchangeLinksEl.querySelectorAll("input[data-date]").forEach((input) => {
    input.addEventListener("input", syncSameLinkAllDays);
    input.addEventListener("change", () => fetchYoutubeTitleInto(input));
  });
  unchangeLinksEl.querySelectorAll("input[data-title-date]").forEach((input) => {
    input.addEventListener("input", syncSameLinkAllDays);
  });
  syncSameLinkAllDays();
}

function titleInputFor(urlInput) {
  return urlInput.nextElementSibling;
}

async function fetchYoutubeTitleInto(urlInput) {
  const titleInput = titleInputFor(urlInput);
  const url = urlInput.value.trim();
  if (!url) return;
  titleInput.value = "Looking up title…";
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error("not found");
    const data = await res.json();
    titleInput.value = data.title || "";
  } catch (e) {
    titleInput.value = "";
  }
  syncSameLinkAllDays();
}

function syncSameLinkAllDays() {
  const urlInputs = Array.from(unchangeLinksEl.querySelectorAll("input[data-date]"));
  if (!urlInputs.length) return;
  const [firstUrl, ...restUrls] = urlInputs;
  const firstTitle = titleInputFor(firstUrl);
  if (sameLinkAllDaysEl.checked) {
    restUrls.forEach((urlInput) => {
      urlInput.value = firstUrl.value;
      urlInput.disabled = true;
      const titleInput = titleInputFor(urlInput);
      titleInput.value = firstTitle.value;
      titleInput.disabled = true;
    });
  } else {
    restUrls.forEach((urlInput) => {
      urlInput.disabled = false;
      titleInputFor(urlInput).disabled = false;
    });
  }
}

sameLinkAllDaysEl.addEventListener("change", syncSameLinkAllDays);

// Restore a previously-entered password for this browser session only.
passwordEl.value = sessionStorage.getItem("qe_admin_password") || "";
passwordEl.addEventListener("input", () => {
  sessionStorage.setItem("qe_admin_password", passwordEl.value);
});

weekStartEl.value = isoDate(currentOrUpcomingMonday());
weekStartEl.addEventListener("change", () => {
  if (!weekStartEl.value) return;
  const d = new Date(weekStartEl.value + "T00:00:00");
  const dow = d.getDay();
  if (dow !== 1) {
    d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
    weekStartEl.value = isoDate(d);
  }
  renderUnchangeInputs();
  loadRecipientsForWeek(weekStartEl.value);
});
renderUnchangeInputs();
loadRecipientsForWeek(weekStartEl.value);

function renderSelectedFiles() {
  selectedFilesEl.innerHTML = "";
  if (!selectedFiles.length) return;
  const list = document.createElement("div");
  list.className = "selected-files-list";
  selectedFiles.forEach((f, i) => {
    const row = document.createElement("div");
    row.className = "selected-file-row";
    const name = document.createElement("span");
    name.textContent = f.name;
    const remove = document.createElement("button");
    remove.textContent = "✕";
    remove.className = "remove-file-btn";
    remove.addEventListener("click", () => {
      selectedFiles.splice(i, 1);
      renderSelectedFiles();
    });
    row.appendChild(name);
    row.appendChild(remove);
    list.appendChild(row);
  });
  selectedFilesEl.appendChild(list);
}

function addFiles(fileList) {
  for (const file of fileList) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const recipe = JSON.parse(reader.result);
        selectedFiles.push({ name: file.name.replace(/\.json$/i, ""), recipe });
        sortByDateName(selectedFiles);
        renderSelectedFiles();
      } catch (e) {
        alert(`Couldn't parse "${file.name}" as JSON: ${e.message}`);
      }
    };
    reader.readAsText(file);
  }
}

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) addFiles(fileInput.files);
  fileInput.value = "";
});
dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("drag"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("drag");
  if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
});

// ── Optional per-day exported JPGs (matched by filename to the JSONs above) ─
function renderSelectedJpgs() {
  selectedJpgsEl.innerHTML = "";
  if (!selectedJpgs.length) return;
  const jsonNames = new Set(selectedFiles.map((f) => f.name.toLowerCase()));
  const list = document.createElement("div");
  list.className = "selected-files-list";
  selectedJpgs.forEach((f, i) => {
    const row = document.createElement("div");
    row.className = "selected-file-row";
    const name = document.createElement("span");
    const matched = jsonNames.has(f.name.toLowerCase());
    name.textContent = f.name + (matched ? "" : " (no matching .json - won't be used)");
    const remove = document.createElement("button");
    remove.textContent = "✕";
    remove.className = "remove-file-btn";
    remove.addEventListener("click", () => {
      selectedJpgs.splice(i, 1);
      renderSelectedJpgs();
    });
    row.appendChild(name);
    row.appendChild(remove);
    list.appendChild(row);
  });
  selectedJpgsEl.appendChild(list);
}

function addJpgFiles(fileList) {
  for (const file of fileList) {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1] || "";
      selectedJpgs.push({ name: file.name.replace(/\.(jpg|jpeg)$/i, ""), base64 });
      sortByDateName(selectedJpgs);
      renderSelectedJpgs();
    };
    reader.readAsDataURL(file);
  }
}

jpgFileInput.addEventListener("change", () => {
  if (jpgFileInput.files.length) addJpgFiles(jpgFileInput.files);
  jpgFileInput.value = "";
});
jpgDropzone.addEventListener("dragover", (e) => { e.preventDefault(); jpgDropzone.classList.add("drag"); });
jpgDropzone.addEventListener("dragleave", () => jpgDropzone.classList.remove("drag"));
jpgDropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  jpgDropzone.classList.remove("drag");
  if (e.dataTransfer.files.length) addJpgFiles(e.dataTransfer.files);
});

// ── Optional single .zip upload (5 .json + 5 .jpg) - unzipped client-side
// and fed into the same selectedFiles/selectedJpgs pipeline as picking the
// files individually, so everything downstream (pairing, sorting, upload)
// is unchanged.
const zipDropzone = document.getElementById("zipDropzone");
const zipFileInput = document.getElementById("zipFileInput");
const zipMsgEl = document.getElementById("zipMsg");

async function handleZipFile(file) {
  zipMsgEl.textContent = `Reading ${file.name}…`;
  zipMsgEl.className = "admin-msg show success";
  try {
    const zip = await JSZip.loadAsync(file);
    let jsonCount = 0;
    let jpgCount = 0;
    for (const entry of Object.values(zip.files)) {
      if (entry.dir) continue;
      const baseName = entry.name.split("/").pop();
      if (/\.json$/i.test(baseName)) {
        const text = await entry.async("string");
        try {
          const recipe = JSON.parse(text);
          selectedFiles.push({ name: baseName.replace(/\.json$/i, ""), recipe });
          jsonCount++;
        } catch (e) {
          alert(`Couldn't parse "${baseName}" from the zip as JSON: ${e.message}`);
        }
      } else if (/\.(jpg|jpeg)$/i.test(baseName)) {
        const base64 = await entry.async("base64");
        selectedJpgs.push({ name: baseName.replace(/\.(jpg|jpeg)$/i, ""), base64 });
        jpgCount++;
      }
    }
    sortByDateName(selectedFiles);
    sortByDateName(selectedJpgs);
    renderSelectedFiles();
    renderSelectedJpgs();
    zipMsgEl.textContent = `Unzipped ${jsonCount} JSON + ${jpgCount} JPG file(s) from ${file.name}.`;
  } catch (e) {
    zipMsgEl.textContent = `Couldn't read ${file.name} as a zip: ${e.message}`;
    zipMsgEl.className = "admin-msg show error";
  }
}

zipFileInput.addEventListener("change", () => {
  if (zipFileInput.files.length) handleZipFile(zipFileInput.files[0]);
  zipFileInput.value = "";
});
zipDropzone.addEventListener("dragover", (e) => { e.preventDefault(); zipDropzone.classList.add("drag"); });
zipDropzone.addEventListener("dragleave", () => zipDropzone.classList.remove("drag"));
zipDropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  zipDropzone.classList.remove("drag");
  const file = e.dataTransfer.files[0];
  if (file) handleZipFile(file);
});

function showMsg(text, isError) {
  uploadMsgEl.textContent = text;
  uploadMsgEl.className = "admin-msg show " + (isError ? "error" : "success");
}

uploadBtn.addEventListener("click", async () => {
  if (!passwordEl.value) { showMsg("Enter the password first.", true); return; }
  if (!selectedFiles.length) { showMsg("Add at least one .json file first.", true); return; }

  const unchangeLinks = Array.from(unchangeLinksEl.querySelectorAll("input[data-date]"))
    .reduce((m, el) => {
      m[el.dataset.date] = { url: el.value, title: titleInputFor(el).value };
      return m;
    }, {});

  uploadBtn.disabled = true;
  showMsg("Uploading…", false);
  try {
    const res = await fetch("/api/weeks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: passwordEl.value,
        weekStart: weekStartEl.value,
        files: selectedFiles.map((f) => {
          const jpg = selectedJpgs.find((j) => j.name.toLowerCase() === f.name.toLowerCase());
          return jpg ? { name: f.name, recipe: f.recipe, jpg_b64: jpg.base64 } : { name: f.name, recipe: f.recipe };
        }),
        unchangeLinks,
        recipients: recipientsEl.value,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showMsg(data.error || "Upload failed.", true);
      return;
    }
    showMsg(`Uploaded ${selectedFiles.length} file(s) for ${weekLabel(weekStartEl.value)}.`, false);
    const uploadedWeekStart = weekStartEl.value;
    selectedFiles = [];
    selectedJpgs = [];
    renderSelectedFiles();
    renderSelectedJpgs();
    // Blob content (unlike its existence in list()) takes a moment to
    // propagate, so the file count could briefly read as 0 without this.
    setTimeout(loadStoredWeeks, 1500);
    await maybeSendWeekEmail(uploadedWeekStart);
  } catch (e) {
    showMsg("Upload failed: " + e.message, true);
  } finally {
    uploadBtn.disabled = false;
  }
});

// Fires the weekly digest email right after a successful upload - gated by
// a confirm() since it's a real send to the full subscriber BCC list, not
// something that should go out silently on every re-upload/correction.
async function maybeSendWeekEmail(weekStart) {
  const recipientCount = recipientsEl.value
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean).length;
  const ok = confirm(`Send the weekly digest email now to ~${recipientCount} recipient(s) for ${weekLabel(weekStart)}?`);
  if (!ok) return;
  try {
    const res = await fetch(`/api/send-week?weekStart=${weekStart}&password=${encodeURIComponent(passwordEl.value)}`);
    const data = await res.json();
    if (!res.ok) {
      showMsg(`Upload OK, but email failed: ${data.error || "unknown error"}`, true);
      return;
    }
    showMsg(`Uploaded and emailed ${data.bcc.length} recipient(s) for ${weekLabel(weekStart)}.`, false);
  } catch (e) {
    showMsg(`Upload OK, but email failed: ${e.message}`, true);
  }
}

function renderStoredWeeks(weeks) {
  storedListEl.innerHTML = "";
  if (!weeks || !weeks.length) {
    storedListEl.innerHTML = '<p class="sub">No weeks stored yet.</p>';
    return;
  }
  const sorted = [...weeks].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  for (const w of sorted) {
    const row = document.createElement("div");
    row.className = "stored-week-row";

    const label = document.createElement("span");
    label.textContent = `${weekLabel(w.weekStart)} — ${w.fileCount} file(s)`;

    const del = document.createElement("button");
    del.textContent = "Delete";
    del.className = "btn btn-gray";
    del.addEventListener("click", async () => {
      if (!passwordEl.value) { showMsg("Enter the password first.", true); return; }
      if (!confirm(`Delete ${weekLabel(w.weekStart)}? This can't be undone.`)) return;
      del.disabled = true;
      try {
        const res = await fetch("/api/weeks", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: passwordEl.value, weekStart: w.weekStart }),
        });
        const data = await res.json();
        if (!res.ok) { showMsg(data.error || "Delete failed.", true); del.disabled = false; return; }
        loadStoredWeeks();
      } catch (e) {
        showMsg("Delete failed: " + e.message, true);
        del.disabled = false;
      }
    });

    row.appendChild(label);
    row.appendChild(del);
    storedListEl.appendChild(row);
  }
}

async function loadStoredWeeks() {
  try {
    const res = await fetch("/api/weeks?counts=1");
    const data = await res.json();
    renderStoredWeeks(data.weeks);
  } catch (e) {
    storedListEl.innerHTML = '<p class="sub">Couldn\'t load stored weeks.</p>';
  }
}

loadStoredWeeks();
