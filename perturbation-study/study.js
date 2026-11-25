// Perturbation-threshold study: for each object x perturbation (stimuli.json, built by
// nvrd/affordance-test/code/study_assets/build_perturbation_study.py), the participant is told the object's
// function and sees all six versions side by side, numbered 0 (the original) to 5 (the strongest perturbation).
// They pick the highest-numbered version they would still recognise as a tool for that function, or "None"
// if not even version 0 is. Trials come in a random order; the six images are always shown 0-5 in order.
// One row per participant is saved to the shared Google Sheet web app with results.study =
// "perturbation_recognition" (routed to the "perturbation" tab). Link: index.html?ID=<name or initials>
const SHEET_URL =
  "https://script.google.com/macros/s/AKfycbywIgg7tMNJVidcxyG25I9tU15H0CYPm_BQvs_DGCQIvBmGtjBsiIClNdRVg9ZNy9W5Rw/exec";
const LEVELS = [0, 1, 2, 3, 4, 5];
const NONE = "None (not even 0)";

function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

(async function () {
  const data = await fetch("stimuli.json").then((r) => r.json());
  const participant = new URLSearchParams(window.location.search).get("ID") || "";

  // one trial per object x perturbation, with the original as level 0 of every sequence
  const byObject = {};
  data.stimuli.forEach(function (s) {
    (byObject[s.object] = byObject[s.object] || { task: s.task, files: {} }).files[`${s.perturbation}_${s.level}`] = s.file;
  });
  const sequences = [];
  Object.keys(byObject).forEach(function (o) {
    const ob = byObject[o];
    ["deform", "add", "remove", "style", "texture"].forEach(function (p) {
      const files = LEVELS.map((k) => (k === 0 ? ob.files["original_0"] : ob.files[`${p}_${k}`]));
      if (files.every(Boolean)) sequences.push({ object: o, task: ob.task, perturbation: p, files: files });
    });
  });
  const order = shuffle(sequences);

  const jsPsych = initJsPsych({});
  const timeline = [];

  order.forEach(function (sq, i) {
    const tiles = sq.files.map((f, k) => `
      <div class="tile"><div class="tile-num">${k}</div><img src="${f}" alt="version ${k}" /></div>`).join("");
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div class="progress">Set ${i + 1} of ${order.length}</div>
        <p class="task-line">This object is for: <strong>${sq.task}</strong></p>
        <div class="tiles">${tiles}</div>
        <p class="question">What is the highest-numbered version you would still recognise as a tool for
        ${sq.task}?</p>`,
      choices: LEVELS.map(String).concat([NONE]),
      data: { object: sq.object, task: sq.task, perturbation: sq.perturbation, position: i + 1, is_item: true },
      on_finish: function (d) {
        d.last_recognisable = d.response === LEVELS.length ? -1 : LEVELS[d.response];
      },
    });
  });

  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <div class="intro">
        <h2>Thank you!</h2>
        <p class="save-status" id="save-status">Saving your answers... please keep this tab open.</p>
      </div>`,
    choices: [],
    on_load: submit,
  });

  let submitted = false;
  function submit() {
    if (submitted) return;
    submitted = true;
    const trials = jsPsych.data.get().filter({ is_item: true }).values().map((t) => ({
      position: t.position, object: t.object, task: t.task, perturbation: t.perturbation,
      last_recognisable: t.last_recognisable, rt_ms: t.rt,
    }));
    const results = {
      study: "perturbation_recognition",
      format: "threshold",  // -1 = not even the original was recognisable
      participant_id: participant,
      start_time: new Date(jsPsych.getStartTime()).toISOString(),
      end_time: new Date().toISOString(),
      total_duration_ms: jsPsych.getTotalTime(),
      trials: trials,
    };
    const status = () => document.getElementById("save-status");
    fetch(SHEET_URL, {
      method: "POST",
      mode: "no-cors",
      keepalive: true,
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ participant: participant || "(no ID)", group: "perturbation", results: results }),
    })
      .then(function () {
        if (status()) status().textContent = "Your answers are saved. You can close this tab.";
      })
      .catch(function () {
        if (status()) {
          status().textContent =
            "Saving failed (check your connection), so your answers are shown below. Please copy all of it and send it to the study organizer.";
          const pre = document.createElement("pre");
          pre.style.cssText = "white-space:pre-wrap;word-break:break-all;max-height:40vh;overflow:auto;text-align:left;font-size:11px";
          pre.textContent = JSON.stringify(results);
          status().after(pre);
        }
      });
  }

  jsPsych.run(timeline);
})();
