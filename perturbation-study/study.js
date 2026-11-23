// Perturbation-recognition study: every image of every perturbed object (stimuli.json, built by
// nvrd/affordance-test/code/study_assets/build_perturbation_study.py) shown once, in a random order; for each the
// participant picks what the object is for from N_OPTIONS tasks (the real one + random others, shuffled per
// trial) or "I can't tell". No going back: answers are first impressions. One row per participant is saved to
// the same Google Sheet web app as the affordance study, with results.study = "perturbation_recognition".
// Link: index.html?ID=<name or initials>
const SHEET_URL =
  "https://script.google.com/macros/s/AKfycbywIgg7tMNJVidcxyG25I9tU15H0CYPm_BQvs_DGCQIvBmGtjBsiIClNdRVg9ZNy9W5Rw/exec";
const N_OPTIONS = 10; // the real task + 9 distractors
const CANT_TELL = "I can't tell";

function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

(async function () {
  const data = await fetch("stimuli.json").then((r) => r.json());
  const participant = new URLSearchParams(window.location.search).get("ID") || "";
  const allTasks = Object.values(data.tasks);
  const order = shuffle(data.stimuli);

  const jsPsych = initJsPsych({});
  const timeline = [];

  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <div class="intro">
        <h2>What is this object for?</h2>
        <p>You'll see ${order.length} pictures of objects, one at a time. Some are unusual versions of everyday
        tools, and some have been changed: bent out of shape, given extra parts, partly erased, drawn in a
        different style, or covered in a different surface.</p>
        <p>For each picture, pick what you think the object is <strong>used for</strong>. If you really can't
        tell, choose <em>${CANT_TELL}</em>.</p>
        <p>Go with your first impression; there's no going back. It takes about 10 minutes.</p>
      </div>`,
    choices: ["Start"],
  });

  order.forEach(function (s, i) {
    const distractors = shuffle(allTasks.filter((t) => t !== s.task)).slice(0, N_OPTIONS - 1);
    const options = shuffle([s.task].concat(distractors));
    const labels = options.map(capitalize).concat([CANT_TELL]);
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div class="progress">Picture ${i + 1} of ${order.length}</div>
        <div class="stimulus-frame"><img src="${s.file}" alt="object" /></div>
        <p class="question">What is this object used for?</p>`,
      choices: labels,
      button_html: labels.map((l) =>
        l === CANT_TELL
          ? '<span class="cant-tell"><button class="jspsych-btn">%choice%</button></span>'
          : '<button class="jspsych-btn">%choice%</button>'
      ),
      data: { stimulus_file: s.file, object: s.object, task: s.task, perturbation: s.perturbation,
              level: s.level, options: options, position: i + 1 },
      on_finish: function (d) {
        const choice = d.response === options.length ? CANT_TELL : options[d.response];
        d.choice = choice;
        d.cant_tell = choice === CANT_TELL;
        d.correct = choice === s.task;
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
    const trials = jsPsych.data.get().filter({}).values()
      .filter((t) => t.stimulus_file)
      .map((t) => ({ position: t.position, file: t.stimulus_file, object: t.object, task: t.task,
                     perturbation: t.perturbation, level: t.level, options: t.options, choice: t.choice,
                     correct: t.correct, cant_tell: t.cant_tell, rt_ms: t.rt }));
    const results = {
      study: "perturbation_recognition",
      participant_id: participant,
      n_options: N_OPTIONS,
      start_time: new Date(jsPsych.getStartTime()).toISOString(),
      end_time: new Date().toISOString(),
      total_duration_ms: jsPsych.getTotalTime(),
      n_correct: trials.filter((t) => t.correct).length,
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
