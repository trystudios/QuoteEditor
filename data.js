const passwordEl = document.getElementById("password");
const weekStartEl = document.getElementById("weekStart");
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const selectedFilesEl = document.getElementById("selectedFiles");
const uploadBtn = document.getElementById("uploadBtn");
const uploadMsgEl = document.getElementById("uploadMsg");
const storedListEl = document.getElementById("storedList");

let selectedFiles = []; // [{name, recipe}]

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
});

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

function showMsg(text, isError) {
  uploadMsgEl.textContent = text;
  uploadMsgEl.className = "admin-msg show " + (isError ? "error" : "success");
}

uploadBtn.addEventListener("click", async () => {
  if (!passwordEl.value) { showMsg("Enter the password first.", true); return; }
  if (!selectedFiles.length) { showMsg("Add at least one .json file first.", true); return; }

  uploadBtn.disabled = true;
  showMsg("Uploading…", false);
  try {
    const res = await fetch("/api/weeks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: passwordEl.value,
        weekStart: weekStartEl.value,
        files: selectedFiles.map((f) => ({ name: f.name, recipe: f.recipe })),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showMsg(data.error || "Upload failed.", true);
      return;
    }
    showMsg(`Uploaded ${selectedFiles.length} file(s) for ${weekLabel(weekStartEl.value)}.`, false);
    selectedFiles = [];
    renderSelectedFiles();
    // Blob content (unlike its existence in list()) takes a moment to
    // propagate, so the file count could briefly read as 0 without this.
    setTimeout(loadStoredWeeks, 1500);
  } catch (e) {
    showMsg("Upload failed: " + e.message, true);
  } finally {
    uploadBtn.disabled = false;
  }
});

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
