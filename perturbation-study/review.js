// Personal review page for the perturbation sequences (not linked from the study). For each object x perturbation
// it shows versions 0-5, the trajectory judge's verdict (trajectory_judgments.json, from
// nvrd/affordance-test/code/image_generation/judge_trajectories.py), and lets the reviewer mark Good / Needs
// regeneration, tick problem levels and add a note. Every change is saved as one row to the shared Google Sheet
// web app with results.study = "perturbation_review" (routed to the "review" tab; latest row per sequence wins),
// and mirrored in localStorage so the page reopens where you left off. Link: review.html?ID=<your initials>
const SHEET_URL =
  "https://script.google.com/macros/s/AKfycbywIgg7tMNJVidcxyG25I9tU15H0CYPm_BQvs_DGCQIvBmGtjBsiIClNdRVg9ZNy9W5Rw/exec";
const FOLDERS = ["deform", "add", "remove", "style", "texture"];
const NAMES = { deform: "shape deformation", add: "part addition", remove: "part removal",
                style: "style degradation", texture: "texture shift" };
const STORE = "perturbation-review-v1";

function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; }
}
function persist(state) {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* storage blocked: sheet still saves */ }
}

(async function () {
  const reviewer = new URLSearchParams(window.location.search).get("ID") || "reviewer";
  const data = await fetch("stimuli.json").then((r) => r.json());
  let judgments = {};
  try { judgments = await fetch("trajectory_judgments.json").then((r) => (r.ok ? r.json() : {})); } catch (e) {}
  const state = load();

  // object -> {task, files: {"<pert>_<level>": file}}
  const byObject = {};
  data.stimuli.forEach(function (s) {
    (byObject[s.object] = byObject[s.object] || { task: s.task, files: {} }).files[`${s.perturbation}_${s.level}`] = s.file;
  });

  const list = document.getElementById("list");
  const zoom = document.createElement("div");
  zoom.id = "zoom";
  zoom.innerHTML = "<img alt='zoomed' />";
  zoom.onclick = () => (zoom.style.display = "none");
  document.body.appendChild(zoom);

  const cards = [];
  Object.keys(byObject).sort().forEach(function (o) {
    const ob = byObject[o];
    const h = document.createElement("h2");
    h.className = "object-title";
    h.textContent = `${o} (${ob.task})`;
    list.appendChild(h);
    FOLDERS.forEach(function (p) {
      const key = `${o}/${p}`;
      const files = [ob.files["original_0"]].concat([1, 2, 3, 4, 5].map((k) => ob.files[`${p}_${k}`]));
      if (!files.every(Boolean)) return;
      const j = judgments[key] || {};
      const jBad = j.bad_levels || [];
      const jText = j.ok === true ? `<span class="pass">judge: PASS</span>`
        : j.ok === false ? `<span class="fail">judge: FAIL, levels ${jBad.join(", ")}</span>` : "judge: not run";
      const st = state[key] || { verdict: "", bad_levels: [], note: "" };

      const card = document.createElement("section");
      card.className = "card";
      card.dataset.key = key;
      card.dataset.flagged = j.ok === false ? "1" : "0";
      card.innerHTML = `
        <div class="card-head">
          <span class="name">${o} · ${NAMES[p]}</span>
          <span class="judge">${jText}${j.summary ? ` — ${j.summary}` : ""}</span>
        </div>
        <div class="tiles">${files.map((f, k) => `
          <div class="tile ${k > 0 && jBad.includes(k) ? "flag" : ""}"><div class="num">${k}</div><img src="${f}" alt="version ${k}" /></div>`).join("")}
        </div>
        <div class="controls">
          <div class="verdict">
            <label><input type="radio" name="v-${key}" value="good" /> Good</label>
            <label><input type="radio" name="v-${key}" value="regen" /> Needs regeneration</label>
          </div>
          <div class="levels">Problem levels:
            ${[1, 2, 3, 4, 5].map((k) => `<label><input type="checkbox" value="${k}" /> ${k}</label>`).join("")}
          </div>
          <div><textarea placeholder="What's wrong / what to change"></textarea>
            <div class="status"></div></div>
        </div>`;
      list.appendChild(card);
      cards.push(card);

      // restore
      card.querySelectorAll(`input[type=radio]`).forEach((r) => (r.checked = r.value === st.verdict));
      card.querySelectorAll(".levels input").forEach((c) => (c.checked = st.bad_levels.includes(+c.value)));
      card.querySelector("textarea").value = st.note || "";
      paint(card, st);

      card.querySelectorAll("img").forEach((im) => (im.onclick = () => {
        zoom.querySelector("img").src = im.src;
        zoom.style.display = "flex";
      }));
      let timer = null;
      function changed(immediate) {
        const s = {
          verdict: (card.querySelector("input[type=radio]:checked") || {}).value || "",
          bad_levels: [...card.querySelectorAll(".levels input:checked")].map((c) => +c.value),
          note: card.querySelector("textarea").value.trim(),
        };
        state[key] = s;
        persist(state);
        paint(card, s);
        updateCounts();
        clearTimeout(timer);
        timer = setTimeout(() => save(key, o, p, s, card), immediate ? 0 : 900);
      }
      card.querySelectorAll("input").forEach((i) => i.addEventListener("change", () => changed(true)));
      card.querySelector("textarea").addEventListener("input", () => changed(false));
    });
  });

  function paint(card, s) {
    card.classList.toggle("good", s.verdict === "good");
    card.classList.toggle("regen", s.verdict === "regen");
  }

  function save(key, o, p, s, card) {
    const status = card.querySelector(".status");
    status.textContent = "saving…";
    const results = { study: "perturbation_review", reviewer: reviewer, sequence: key, object: o, perturbation: p,
                      verdict: s.verdict, bad_levels: s.bad_levels, note: s.note, saved_at: new Date().toISOString() };
    fetch(SHEET_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ participant: reviewer, group: key, results: results }),
    })
      .then(() => (status.textContent = "saved " + new Date().toLocaleTimeString()))
      .catch(() => (status.textContent = "save failed (kept in this browser; will retry on next change)"));
  }

  const filter = document.getElementById("filter");
  function updateCounts() {
    const vals = Object.values(state);
    const good = vals.filter((s) => s.verdict === "good").length;
    const regen = vals.filter((s) => s.verdict === "regen").length;
    const flagged = cards.filter((c) => c.dataset.flagged === "1").length;
    document.getElementById("counts").textContent =
      `${cards.length} sequences · ${good} good · ${regen} need regeneration · ${cards.length - good - regen} unreviewed · judge flagged ${flagged}`;
  }
  function applyFilter() {
    const f = filter.value;
    cards.forEach(function (c) {
      const s = state[c.dataset.key] || {};
      const show = f === "all" || (f === "flagged" && c.dataset.flagged === "1") ||
        (f === "unreviewed" && !s.verdict) || (f === "regen" && s.verdict === "regen");
      c.style.display = show ? "" : "none";
    });
    document.querySelectorAll(".object-title").forEach(function (h) {
      let n = h.nextElementSibling, any = false;
      while (n && n.classList.contains("card")) { if (n.style.display !== "none") any = true; n = n.nextElementSibling; }
      h.style.display = any ? "" : "none";
    });
  }
  filter.addEventListener("change", applyFilter);
  updateCounts();
})();
