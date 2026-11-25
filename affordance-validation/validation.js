// Model-validation study: a parallel version of the affordance study. Each trial shows one part of a novel object
// (the same numbered + highlighted images as the original study) and ONE model's answer for what that part could
// be used for (its single best functionality + one-sentence reason). The participant rates it Agree / Neutral /
// Disagree (required) and can explain why (optional). Which model gave the answer is recorded but not shown.
// Items come from validation_items.json (built by nvrd/affordance-test/code/study_assets/build_validation_study.py):
// GROUP = one object set x one model rotation, so a participant rates every part of their objects once.
// Results go to the same Google Sheet web app as the other studies, with results.study = "model_validation".
// Link: index.html?GROUP=<0 or 1>&ID=<name or initials>
const SHEET_URL =
  "https://script.google.com/macros/s/AKfycbywIgg7tMNJVidcxyG25I9tU15H0CYPm_BQvs_DGCQIvBmGtjBsiIClNdRVg9ZNy9W5Rw/exec";
const IMAGES = "../affordance-study/images/";
const RATINGS = ["Agree", "Neutral", "Disagree"];

function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s || "";
  return d.innerHTML;
}

function shownLabel(label) {
  return label === "none" ? "none (no particular use)" : label.replace(/_/g, " ");
}

(async function () {
  const data = await fetch("validation_items.json").then((r) => r.json());
  const params = new URLSearchParams(window.location.search);
  const participant = params.get("ID") || "";
  let group = parseInt(params.get("GROUP"), 10);
  if (isNaN(group) || group < 0 || group >= data.groups.length) group = Math.floor(Math.random() * data.groups.length);
  const items = shuffle(data.groups[group]);

  const jsPsych = initJsPsych({});
  const timeline = [];

  items.forEach(function (it, i) {
    const reason = it.justification ? `<div class="reason">"${esc(it.justification)}"</div>` : "";
    // the part's 10-option list from the original study, with the AI's answer highlighted (added if not in it)
    const opts = (it.options || []).map((o) =>
      `<span class="opt${o === it.label ? " picked" : ""}">${esc(shownLabel(o))}</span>`).join("");
    const extra = it.options && it.options.length && !it.label_in_options
      ? `<span class="opt picked outside">${esc(shownLabel(it.label))}</span>
         <div class="opt-note">The highlighted answer is the AI's own; it isn't one of these options.</div>` : "";
    const optionBlock = it.options && it.options.length
      ? `<div class="option-list"><div class="opt-label">Options for this part (the AI's answer is highlighted)</div>
           <div class="opts">${opts}${extra}</div></div>` : "";
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div class="progress">Part ${i + 1} of ${items.length}</div>
        <div class="images">
          <div class="image-box"><div class="label">All parts</div>
            <div class="frame"><img src="${IMAGES}${it.object}_numbered.png" alt="object with numbered parts" /></div></div>
          <div class="image-box"><div class="label">Part ${it.part} of ${it.n_parts} (highlighted)</div>
            <div class="frame"><img src="${IMAGES}${it.object}_highlight_part${it.part}.png" alt="highlighted part" /></div></div>
        </div>
        <div class="model-answer">
          An AI model was asked what part ${it.part} could be used for. Its answer:
          <div class="answer">${esc(shownLabel(it.label))}</div>
          ${reason}
        </div>
        ${optionBlock}
        <div class="rating">
          <p class="question">Do you agree with this answer?</p>
          <div class="choices">${RATINGS.map((r) => `<div class="choice" data-value="${r}">${r}</div>`).join("")}</div>
          <label for="explanation">Why? (optional)</label>
          <textarea id="explanation" placeholder="e.g. the part is flat and sturdy, so it could support something"></textarea>
          <div class="hint" id="hint"></div>
        </div>`,
      choices: ["Next"],
      data: { object: it.object, part: it.part, region_id: it.region_id, model: it.model, label: it.label,
              justification: it.justification, options_shown: it.options || [],
              label_in_options: !!it.label_in_options, position: i + 1, is_item: true },
      on_load: function () {
        // capture answers live into the trial data (the DOM is gone by on_finish) and gate the Next button
        const trial = jsPsych.getCurrentTrial();
        const btn = document.querySelector("#jspsych-html-button-response-btngroup button");
        const box = document.getElementById("explanation");
        const hint = document.getElementById("hint");
        trial.data.rating = null;
        trial.data.explanation = "";
        function check() {
          trial.data.explanation = box.value.trim();
          const ok = !!trial.data.rating;
          btn.disabled = !ok;
          hint.textContent = ok ? "" : "Choose Agree, Neutral or Disagree to continue.";
        }
        document.querySelectorAll(".choice").forEach(function (c) {
          c.addEventListener("click", function () {
            document.querySelectorAll(".choice").forEach((x) => x.classList.remove("selected"));
            c.classList.add("selected");
            trial.data.rating = c.dataset.value;
            check();
          });
        });
        box.addEventListener("input", check);
        check();
        window.scrollTo(0, 0);
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
      position: t.position, object: t.object, part: t.part, region_id: t.region_id, model: t.model, label: t.label,
      justification: t.justification, options_shown: t.options_shown, label_in_options: t.label_in_options,
      rating: t.rating, explanation: t.explanation, rt_ms: t.rt,
    }));
    const results = {
      study: "model_validation",
      participant_id: participant,
      group_index: group,
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
      body: JSON.stringify({ participant: participant || "(no ID)", group: "validation-" + group, results: results }),
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
