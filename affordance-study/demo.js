// Preview of the affordance-study design for ONE object -- OPEN-ELICITATION version. Internally and
// in all user-facing text this calls everything a "functionality," not an "affordance" -- most
// participants won't know that word. Walks through a short TRAINING phase on 5 known, familiar
// objects first, then every one of the target object's regions in turn, then submits via
// Proliferate -- the exact same mechanism ../experiment.js uses for the main study
// (proliferate.submit(), with the same #thanks div / on_finish / thanks-trial on_load pattern), just
// with "training" + "regions" payloads instead of "trials". No consent/attention-check trials yet --
// those still only exist in the main study.
//
// WHAT CHANGED FROM THE EARLIER (rating-based) VERSION OF THIS DEMO, AND WHY:
//   - No model's label is shown or rated anymore. Participants pick their OWN functionality
//     word(s) for each part, blind to what any AI model guessed -- open elicitation instead of
//     agreement-rating, which avoids anchoring participants on a specific model's answer. Each of
//     the 4 VLMs' labels for a region are still recorded in the submitted data (model_labels, from
//     the manifest's per-region `labels`) purely for later offline comparison against what humans
//     actually said.
//   - No "propose a better affordance" follow-up either -- there's no AI answer left to disagree
//     with, so that whole conditional branch is gone.
//   - A training phase was added: 5 trials on real, familiar objects (chair/ladle/fedora/backpack/
//     wallet) with one obviously-correct part + functionality each (picked by hand, cross-checked
//     against json/affordance_justification/ data in the main NVRD repo -- see
//     generate_training_images.py there for exactly which region and why). Whether each training
//     trial was answered correctly, and an overall training_passed flag, are recorded in the
//     submitted data (not shown to the participant as a score -- this is for us to filter on later,
//     not to make someone feel like they failed a test before the real task even starts).
//
// example_manifest.json: {vocabulary: [...37 AGD20K-style classes...], models: [...4 VLM keys...],
// regions: [one row per region]}. Each region row is {part, region_id, labels: {model_key: label}}.
(async function () {
  const manifest = await fetch("example_manifest.json").then((r) => r.json());
  const vocabulary = manifest.vocabulary;
  const regions = manifest.regions;
  const n_parts = regions.length;
  const object_name = "shape_16";
  const regions_image = "images/shape_16_numbered.png";

  const SIZE_CHART_SCALES = ["hand", "human", "building"];
  const size_chart_scale = SIZE_CHART_SCALES[Math.floor(Math.random() * SIZE_CHART_SCALES.length)];
  const size_chart_image = `images/${object_name}_${size_chart_scale}.png`;

  const prolific = get_prolific_params();

  const jsPsych = initJsPsych({
    on_finish: function () {
      document.getElementById("thanks").style.display = "";
      submit_results();
    },
  });

  function escape_html(s) {
    const div = document.createElement("div");
    div.textContent = s || "";
    return div.innerHTML;
  }

  // Real, familiar objects with one hand-picked part each that has an unambiguous correct
  // functionality -- see generate_training_images.py (main NVRD repo) for the region_id each came
  // from and the area/visual cross-check done before picking it. `accepted` lists every reasonable
  // synonym a participant might type/pick, not just one exact word -- training should weed out
  // nonsense answers ("decoration", random unrelated words), not penalize reasonable wording choices.
  const TRAINING_ITEMS = [
    {
      object: "chair",
      numbered_image: "images/chair_numbered.png",
      highlight_image: "images/chair_highlight_part1.png",
      part: 1,
      n_parts: 16,
      accepted: ["sit on"],
    },
    {
      object: "ladle",
      numbered_image: "images/ladle_numbered.png",
      highlight_image: "images/ladle_highlight_part3.png",
      part: 3,
      n_parts: 4,
      accepted: ["scoop", "stir", "contain", "pour"],
    },
    {
      object: "fedora",
      numbered_image: "images/fedora_numbered.png",
      highlight_image: "images/fedora_highlight_part1.png",
      part: 1,
      n_parts: 6,
      accepted: ["wear"],
    },
    {
      object: "backpack",
      numbered_image: "images/backpack_numbered.png",
      highlight_image: "images/backpack_highlight_part1.png",
      part: 1,
      n_parts: 11,
      accepted: ["carry", "contain", "hold", "open"],
    },
    {
      object: "wallet",
      numbered_image: "images/wallet_numbered.png",
      highlight_image: "images/wallet_highlight_part1.png",
      part: 1,
      n_parts: 1,
      accepted: ["open", "contain", "hold", "carry"],
    },
  ];
  // Passed if at least 4 of 5 training items got a correct answer -- documented threshold, not
  // requiring a perfect 5/5, since a reasonable person can still phrase a correct answer in a way
  // that happens to miss every accepted synonym once without that meaning they don't understand the
  // task. Adjust here if a stricter/looser bar is wanted.
  const TRAINING_PASS_THRESHOLD = 4;

  function training_item_correct(item, selected) {
    const acceptedLower = item.accepted.map(function (a) {
      return a.toLowerCase();
    });
    return selected.some(function (s) {
      return acceptedLower.indexOf(s.toLowerCase().trim()) !== -1;
    });
  }

  const intro = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <div class="instructions-container">
        <h2>Instructions (demo)</h2>
        <p>You will see an object divided into numbered parts. For each part, your job is to say
        what it could realistically be used to <strong>DO</strong> &mdash; its
        <strong>functionality</strong> &mdash; not just what it looks like or what it's made of.</p>
        <div class="note-box">
          <p><strong>"Decoration," "looks nice," "it's pretty," or anything like that does NOT
          count.</strong> We're asking what a part could physically be used for, the way a handle
          can be gripped or a blade can cut &mdash; not how it looks.</p>
        </div>
        <p>For each part:</p>
        <ol>
          <li>Look at the images: the whole object with its parts numbered, the one part you're
          judging highlighted, and a size reference showing how big the object might be.</li>
          <li>Pick <strong>up to 3</strong> functionalities from the provided list by clicking them,
          or type your own if the list is missing something.</li>
          <li>Then briefly imagine actually using that part as a tool: what would you use it to
          interact with, in what setting, and what the scene looks like right before and right
          after.</li>
        </ol>
        <p>First, you'll do <strong>5 short training rounds</strong> on everyday objects (a chair, a
        ladle, etc.) to get used to how this works, before moving on to the real task.</p>
      </div>
    `,
    choices: ["Begin Training"],
  };

  const timeline = [intro];

  // ---- Training phase: 5 trials on known objects, same picker UI as the real task. ----
  const training_trials = TRAINING_ITEMS.map(function (item, i) {
    return {
      type: jsPsychHtmlButtonResponse,
      stimulus:
        `<div class="demo-banner">Training &mdash; ${i + 1} of ${TRAINING_ITEMS.length}</div>` +
        `<div class="trial-container">` +
        build_training_images_block(item.numbered_image, item.highlight_image, item.part, item.n_parts) +
        build_functionality_picker_block(vocabulary) +
        `</div>`,
      choices: ["Continue"],
      data: { is_training: true, training_index: i, training_object: item.object },
      on_finish: function (data) {
        const selected = get_selected_functionalities();
        data.functionalities_selected = selected;
        data.training_correct = training_item_correct(item, selected);
      },
    };
  });
  timeline.push(...training_trials);

  const training_done = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <div class="instructions-container">
        <h2>Training complete</h2>
        <p>Now you'll do the same thing for a new object, part by part.</p>
      </div>
    `,
    choices: ["Begin"],
  };
  timeline.push(training_done);

  // ---- Main task: one elicitation trial + one "imagine using it" trial per region. ----
  regions.forEach(function (row, i) {
    const functionality_trial = {
      type: jsPsychHtmlButtonResponse,
      stimulus:
        `<div class="demo-banner">Demo &mdash; region ${i + 1} of ${n_parts}</div>` +
        build_functionality_trial_html(
          regions_image,
          `images/shape_16_highlight_part${row.part}.png`,
          size_chart_image,
          size_chart_scale,
          row.part,
          n_parts,
          vocabulary
        ),
      choices: ["Continue"],
      data: {
        part: row.part,
        region_id: row.region_id,
        model_labels: row.labels, // recorded for later comparison, never shown to the participant
      },
      on_finish: function (data) {
        data.functionalities_selected = get_selected_functionalities();
      },
    };

    const tool_use_trial = {
      type: jsPsychHtmlButtonResponse,
      stimulus:
        `<div class="trial-container">` +
        build_functionality_images_block(
          regions_image,
          `images/shape_16_highlight_part${row.part}.png`,
          size_chart_image,
          size_chart_scale,
          row.part,
          n_parts
        ) +
        build_tool_use_block() +
        `</div>`,
      choices: ["Continue"],
      data: { part: row.part, is_tool_use: true },
      on_finish: function (data) {
        const interaction_box = document.querySelector("#tool-interaction-input");
        const before_box = document.querySelector("#before-state-input");
        const after_box = document.querySelector("#after-state-input");
        data.tool_interaction = interaction_box ? interaction_box.value.trim() : "";
        data.before_state = before_box ? before_box.value.trim() : "";
        data.after_state = after_box ? after_box.value.trim() : "";
      },
    };

    timeline.push({ timeline: [functionality_trial, tool_use_trial] });
  });

  const summary = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      const answered = jsPsych.data
        .get()
        .filter(function (t) {
          return t.functionalities_selected !== undefined && !t.is_training;
        })
        .values();

      const table_rows = answered
        .map(function (t) {
          const list = (t.functionalities_selected || []).map(escape_html).join(", ") || "&mdash;";
          return `<tr><td>${t.part}</td><td>${list}</td></tr>`;
        })
        .join("");
      return `
        <div class="demo-result">
          <h2>All ${answered.length} regions answered</h2>
          <table class="summary-table">
            <thead><tr><th>Part</th><th>Functionalities you picked</th></tr></thead>
            <tbody>${table_rows}</tbody>
          </table>
        </div>
      `;
    },
    choices: ["Continue"],
  };
  timeline.push(summary);

  const thanks = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <div class="practice-done-container">
        <h2>Thank you!</h2>
        <p>Submitting your data... please wait.</p>
        <p>You will be redirected to Prolific automatically.</p>
      </div>
    `,
    choices: [],
    on_load: function () {
      submit_results();
    },
  };
  timeline.push(thanks);

  function submit_results() {
    const training_data = jsPsych.data
      .get()
      .filter({ is_training: true })
      .values()
      .map(function (t) {
        return {
          object: t.training_object,
          functionalities_selected: t.functionalities_selected,
          correct: t.training_correct,
          response_time_ms: t.rt,
        };
      });
    const training_correct_count = training_data.filter(function (t) {
      return t.correct;
    }).length;
    const training_passed = training_correct_count >= TRAINING_PASS_THRESHOLD;

    const tool_uses = jsPsych.data.get().filter({ is_tool_use: true }).values();
    const tool_use_by_part = {};
    tool_uses.forEach(function (t) {
      tool_use_by_part[t.part] = {
        tool_interaction: t.tool_interaction,
        before_state: t.before_state,
        after_state: t.after_state,
        response_time_ms: t.rt,
      };
    });

    const region_data = jsPsych.data
      .get()
      .filter(function (t) {
        return t.functionalities_selected !== undefined && !t.is_training && !t.is_tool_use;
      })
      .values()
      .map(function (t) {
        const tu = tool_use_by_part[t.part];
        return {
          part: t.part,
          region_id: t.region_id,
          model_labels: t.model_labels,
          functionalities_selected: t.functionalities_selected,
          response_time_ms: t.rt,
          tool_interaction: tu ? tu.tool_interaction : null,
          before_state: tu ? tu.before_state : null,
          after_state: tu ? tu.after_state : null,
          tool_use_response_time_ms: tu ? tu.response_time_ms : null,
        };
      });

    const results = {
      prolific_pid: prolific.prolific_pid || "",
      study_id: prolific.study_id,
      session_id: prolific.session_id,
      object: object_name,
      regions_image: regions_image,
      size_chart_scale: size_chart_scale,
      training: training_data,
      training_correct_count: training_correct_count,
      training_passed: training_passed,
      study_start_time: new Date(jsPsych.getStartTime()).toISOString(),
      study_end_time: new Date().toISOString(),
      total_duration_ms: jsPsych.getTotalTime(),
      regions: region_data,
    };

    proliferate.submit(results);
  }

  jsPsych.run(timeline);
})();
