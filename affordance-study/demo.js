// Preview of the affordance-acceptability study design for ONE object. Walks through every one of
// the object's regions in turn (the "iterate through all the regions" design), each rated on its own
// 5-point scale, then submits via Proliferate -- the exact same mechanism ../experiment.js uses for
// the main study (proliferate.submit(), with the same #thanks div / on_finish / thanks-trial
// on_load pattern), just with a "regions" payload instead of "trials". No consent/practice/attention
// checks yet -- those still only exist in the main study.
//
// example_manifest.json: {vocabulary: [...37 AGD20K-style classes...], models: [...4 VLM keys...],
// regions: [one row per region]}. Each region row is {part, region_id, labels: {model_key: label}} --
// one forced-choice label per model, all four run through the identical per-part prompt/vocabulary
// (batch_final_labeling.py's MODELS registry in the main NVRD repo), so they're directly comparable
// and swappable. GAT is NOT in this rotation -- it uses a different, 8-word vocabulary from an
// unrelated pixel-level pipeline, so its label can't share a candidate-chip list with the VLMs'
// 37-word AGD20K vocabulary without a lossy remapping; it stays a separate comparison elsewhere.
//
// For EACH region, ONE of the 4 models' labels is picked at random (pick_shown_label() below) and
// that's the "AI model's pick" the participant sees and rates -- independently per region, not once
// per participant, so a single submission samples multiple models and every model accumulates
// roughly even coverage across many participants without needing a between-subjects assignment. The
// participant is never told which model produced the label shown (same blinding as before); which
// model was actually shown is recorded in the submitted data (shown_model) for later per-model
// analysis, but is NOT rendered anywhere in the on-screen UI.
//
// The claim rated is comparative, not absolute: whether the model's pick is the BEST explanation
// among the full candidate list (shown above the images), not just whether it's acceptable at all.
//
// Each region is a short sub-timeline, not a single trial:
//   1. The Likert rating, with an always-visible, optional "explain your reasoning" box embedded in
//      the same screen (html-button-response always renders its buttons after the stimulus HTML, so
//      the box sits below the question but above the rating buttons -- there's no jsPsych-native way
//      to put free text after the buttons on one screen).
//   2. A conditional follow-up, shown only when the rating is NOT Agree/Strongly Agree (<=3 on the
//      5-point scale), asking for a more fitting affordance -- the same conditional_function pattern
//      the main study already uses for its practice-trial retry loops.
//   3. An "imagine using it" probe, shown for every region regardless of the rating: a free-text tool-
//      use scenario (what would this part interact with, and where), plus the before/after states of
//      that same imagined task as two short structured fields -- see build_tool_use_block() in
//      affordance_util.js for why structured beats one free-text narrative here.
//
// Every screen also shows a size-reference chart (generate_size_charts.py in the main NVRD repo):
// the object's silhouette, extracted from its own render via classical CV (not AI-drawn), next to a
// fixed-height human figure, at ONE of three hypothetical real-world sizes (hand/chair-table/two-
// story-building). Knowing the object's assumed scale matters for judging part affordances (a
// "handle" reads very differently on a hand-sized object vs. a building-sized one), but the novel
// shapes have no canonical real-world size -- so which of the three charts is shown is picked
// uniformly at random ONCE per session (pick_size_chart_scale(), below), not re-rolled per region,
// since it's the same object throughout this single-object demo. Which scale was shown is recorded
// in the submitted data (size_chart_scale, session-level) so scale-sensitivity of judgments across
// many participants/sessions can be analyzed later.
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

  // 5-point scale (not the main study's 7-point) per the current design.
  const likert_choices = ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"];
  const AGREE_THRESHOLD = 4; // ratings >= this (Agree, Strongly Agree) skip the "propose better" follow-up

  function escape_html(s) {
    const div = document.createElement("div");
    div.textContent = s || "";
    return div.innerHTML;
  }

  // Picks one model uniformly at random from whichever models actually have a label for this region
  // (all 4 should, in practice, but this degrades gracefully if a future object is missing one).
  const models = manifest.models;
  function pick_shown_label(labels) {
    const available = models.filter(function (m) {
      return labels[m] !== undefined;
    });
    const model = available[Math.floor(Math.random() * available.length)];
    return { model: model, affordance: labels[model] };
  }

  const intro = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <div class="instructions-container">
        <h2>Instructions (demo)</h2>
        <p>You will see an object divided into numbered parts. For each part, an AI model has picked
        <strong>one</strong> affordance &mdash; from the list shown above the images &mdash; that it
        thinks best explains what that part is used for. A third image shows one possible real-world
        size for the object, next to an average adult, since that affects what a part is plausibly
        used for.</p>
        <div class="note-box">
          <p><strong>Many of the listed affordances might reasonably apply</strong> to a given part
          &mdash; a handle, for instance, could plausibly be gripped, pulled, or pushed. We are not
          asking whether the model's choice is merely plausible. We are asking whether it is the
          <strong>most fitting</strong> choice, compared to the other alternatives listed.</p>
        </div>
        <p>For each part:</p>
        <ol>
          <li>Look at the images and the list of possible affordances.</li>
          <li>Rate how much you agree that the model's choice is the <strong>best</strong> fit, on a
          5-point scale.</li>
          <li>If you don't fully agree (anything short of "Agree"), you'll be asked to briefly explain
          why and suggest a more fitting affordance.</li>
          <li>Finally, imagine actually using that part as a tool: what would you use it to interact
          with, in what setting, and what does the scene look like right before and right after.</li>
        </ol>
      </div>
    `,
    choices: ["Begin Demo"],
  };

  const timeline = [intro];

  regions.forEach(function (row, i) {
    // Picked ONCE per region, outside the trial objects, so rating_trial/followup/tool_use_trial for
    // THIS region all show and reference the same chosen model's label -- the shuffle is per-region,
    // not re-rolled on every trial screen within a region.
    const shown = pick_shown_label(row.labels);

    const rating_trial = {
      type: jsPsychHtmlButtonResponse,
      stimulus:
        `<div class="demo-banner">Demo &mdash; region ${i + 1} of ${n_parts}</div>` +
        build_affordance_trial_html(
          regions_image,
          `images/shape_16_highlight_part${row.part}.png`,
          size_chart_image,
          size_chart_scale,
          row.part,
          shown.affordance,
          n_parts,
          vocabulary
        ) +
        `
        <div class="reasoning-block">
          <label for="reasoning-input" class="reasoning-label">
            (Optional) Briefly explain your reasoning for this rating:
          </label>
          <textarea id="reasoning-input" class="text-input" rows="2"
            placeholder="What makes this affordance a good or poor fit for this part?"></textarea>
        </div>
      `,
      choices: likert_choices,
      data: {
        part: row.part,
        region_id: row.region_id,
        affordance: shown.affordance,
        shown_model: shown.model,
      },
      on_finish: function (data) {
        data.rating = data.response + 1; // 1 (Strongly Disagree) .. 5 (Strongly Agree)
        const box = document.querySelector("#reasoning-input");
        data.reasoning = box ? box.value.trim() : "";
      },
    };

    const followup = {
      timeline: [
        {
          type: jsPsychHtmlButtonResponse,
          stimulus: function () {
            return `
              <div class="trial-container">
                ${build_affordance_stimulus_block(
                  regions_image,
                  `images/shape_16_highlight_part${row.part}.png`,
                  size_chart_image,
                  size_chart_scale,
                  row.part,
                  shown.affordance,
                  n_parts,
                  vocabulary
                )}
                <div class="followup-container">
                  <p>You indicated the model's choice &mdash;
                  <span class="affordance-word">${shown.affordance}</span> &mdash; for Part
                  <span class="part-number">${row.part}</span> might not be the best fit.</p>
                  <label for="better-affordance-input" class="reasoning-label">
                    What affordance would be a more fitting label for this part?
                  </label>
                  <input type="text" id="better-affordance-input" class="text-input"
                    placeholder="e.g. support" />
                </div>
              </div>
            `;
          },
          choices: ["Continue"],
          data: { part: row.part, is_followup: true },
          on_finish: function (data) {
            const box = document.querySelector("#better-affordance-input");
            data.proposed_affordance = box ? box.value.trim() : "";
          },
        },
      ],
      conditional_function: function () {
        const last = jsPsych.data.get().last(1).values()[0];
        return last.rating !== undefined && last.rating < AGREE_THRESHOLD;
      },
    };

    const tool_use_trial = {
      type: jsPsychHtmlButtonResponse,
      stimulus:
        `<div class="trial-container">` +
        build_affordance_stimulus_block(
          regions_image,
          `images/shape_16_highlight_part${row.part}.png`,
          size_chart_image,
          size_chart_scale,
          row.part,
          shown.affordance,
          n_parts,
          vocabulary
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

    timeline.push({ timeline: [rating_trial, followup, tool_use_trial] });
  });

  const summary = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      const ratings = jsPsych.data
        .get()
        .filter(function (t) {
          return t.rating !== undefined;
        })
        .values();
      const followups = jsPsych.data.get().filter({ is_followup: true }).values();
      const followup_by_part = {};
      followups.forEach(function (f) {
        followup_by_part[f.part] = f.proposed_affordance;
      });

      // Deliberately NOT shown here: which model produced each label (shown_model is in the
      // submitted data for our analysis, but revealing it on-screen would un-blind the participant
      // after the fact, for no benefit to them).
      const table_rows = ratings
        .map(function (t) {
          const proposed = followup_by_part[t.part];
          return (
            `<tr><td>${t.part}</td><td>${t.affordance}</td>` +
            `<td>${likert_choices[t.rating - 1]}</td>` +
            `<td>${escape_html(t.reasoning)}</td>` +
            `<td>${proposed ? escape_html(proposed) : "&mdash;"}</td></tr>`
          );
        })
        .join("");
      return `
        <div class="demo-result">
          <h2>All ${ratings.length} regions rated</h2>
          <table class="summary-table">
            <thead><tr><th>Part</th><th>Label shown</th><th>Rating</th>
              <th>Reasoning</th><th>Proposed label</th></tr></thead>
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
    const followups = jsPsych.data.get().filter({ is_followup: true }).values();
    const followup_by_part = {};
    followups.forEach(function (f) {
      followup_by_part[f.part] = { proposed_affordance: f.proposed_affordance, response_time_ms: f.rt };
    });

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
        return t.rating !== undefined;
      })
      .values()
      .map(function (t) {
        const fu = followup_by_part[t.part];
        const tu = tool_use_by_part[t.part];
        return {
          part: t.part,
          region_id: t.region_id,
          affordance: t.affordance,
          shown_model: t.shown_model,
          rating: t.rating,
          response_time_ms: t.rt,
          reasoning: t.reasoning,
          proposed_affordance: fu ? fu.proposed_affordance : null,
          proposed_affordance_response_time_ms: fu ? fu.response_time_ms : null,
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
      study_start_time: new Date(jsPsych.getStartTime()).toISOString(),
      study_end_time: new Date().toISOString(),
      total_duration_ms: jsPsych.getTotalTime(),
      regions: region_data,
    };

    proliferate.submit(results);
  }

  jsPsych.run(timeline);
})();
