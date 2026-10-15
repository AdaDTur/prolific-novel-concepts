// Preview of the affordance-study design -- OPEN-ELICITATION, MULTI-OBJECT version. Internally and
// in all user-facing text this calls everything a "functionality," not an "affordance" -- most
// participants won't know that word. Walks through a short TRAINING phase on 5 known, familiar
// objects first, then for EACH object in this participant's assigned group
// (participant_groups.json, same ?GROUP=N URL-param convention ../util.js's getParticipantGroup()
// uses for the main study): every one of that object's regions in turn, then one whole-object
// question, before moving on to the next object in the group. Submits everything in one combined
// payload via Proliferate, same mechanism ../experiment.js uses (proliferate.submit(), #thanks div /
// on_finish / thanks-trial on_load pattern).
//
// WHAT CHANGED FROM THE SINGLE-OBJECT VERSION, AND WHY:
//   - No more hardcoded shape_16/example_manifest.json. Each participant session is assigned one
//     GROUP from participant_groups.json (built by generate_participant_groups.py in the main NVRD
//     repo), which lists several {object, size} pairs -- a balanced partition of the full
//     object x size grid so every (object, size) pair collects the same number of independent human
//     annotations, with which size is shuffled per object rather than fixed for the whole group.
//     This session loops over every {object, size} pair in its assigned group, fetching that
//     object's own manifests/<object>.json (built by generate_study_object_assets.py) instead of a
//     single shared example manifest.
//   - submit_results() now emits one `objects` array (one block per object in the group), each with
//     its own `regions` + whole-object answer, instead of a single flat top-level `regions` array.
//     Everything else (training shape, per-region/tool-use/overall trial shape) is unchanged from
//     the single-object version.
(async function () {
  const groups_data = await fetch("participant_groups.json").then((r) => r.json());
  const group_index = get_participant_group_index(groups_data.num_groups);
  const assignment = groups_data.groups[group_index]; // [{object, size}, ...] for this session

  const manifests = {};
  await Promise.all(
    assignment.map(function (a) {
      return fetch(`manifests/${a.object}.json`)
        .then((r) => r.json())
        .then((m) => {
          manifests[a.object] = m;
        });
    })
  );

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

  // Reads ?GROUP=N from the URL (0-indexed, same convention ../util.js's getParticipantGroup() uses
  // for the main study); falls back to a random group if missing/out of range, so opening the link
  // with no query param still works for manual testing/preview.
  function get_participant_group_index(num_groups) {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("GROUP");
    const n = raw !== null ? parseInt(raw, 10) : NaN;
    if (!isNaN(n) && n >= 0 && n < num_groups) {
      return n;
    }
    return Math.floor(Math.random() * num_groups);
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

  const research_info = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <div class="instructions-container">
        <h2>About this study</h2>
        <p>This is a research study out of the University of Illinois Urbana-Champaign (UIUC), run
        by Ada Tur (adadt2@illinois.edu) and supervised by Professor Heng Ji. We're looking at how
        AI vision-language models learn what novel, made-up objects could be used for, and comparing
        that to how humans figure out the same thing just by looking. Your answers help us see where
        these models line up with human judgment and where they don't.</p>
        <p>Your participation is voluntary and you can stop at any point without any penalty. We
        don't collect your name or any other personally identifying info, your Prolific ID is only
        used to verify participation and process payment, and your responses are kept anonymous and
        used for research purposes only (they may show up, anonymized, in academic papers or
        datasets we publish).</p>
        <p>Questions, concerns, or just want to know more? Reach out anytime at
        adadt2@illinois.edu.</p>
      </div>
    `,
    choices: ["Continue"],
  };

  const intro = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <div class="instructions-container">
        <h2>Instructions (demo)</h2>
        <p>You'll see a series of objects, each split into numbered parts. For each part, just tell
        us what it could realistically be used to <strong>DO</strong>, that's its
        <strong>functionality</strong>, not just what it looks like or what it's made of.</p>
        <div class="note-box">
          <p><strong>"Decoration," "looks nice," "it's pretty," or anything like that doesn't
          count.</strong> We want what a part could physically be used for, like how a handle can be
          gripped or a blade can cut, not how it looks.</p>
        </div>
        <p>For each part:</p>
        <ol>
          <li>Look at the images. You'll see the whole object with its parts numbered, the one part
          you're judging highlighted, and a size reference showing how big the object might be.</li>
          <li>Pick <strong>up to 3</strong> functionalities from the list by clicking them, or type
          your own if the list is missing something.</li>
          <li>Then briefly imagine actually using that part as a tool. What would you use it to
          interact with, and in what setting?</li>
        </ol>
        <p>Once you've gone through every part of an object, you'll answer <strong>one final
        question</strong> about the object as a whole. Step back from the individual parts and tell
        us what you'd say its overall functionality is. Then you'll move on to the next object and do
        the same thing again.</p>
        <p>First you'll see <strong>two worked examples</strong> showing what a good answer looks
        like, then do <strong>5 short training rounds</strong> on everyday objects (a chair, a ladle,
        etc.) to get the hang of it before moving on to the real task.</p>
      </div>
    `,
    choices: ["Begin Training"],
  };

  const timeline = [research_info, intro];

  // ---- Two worked examples, shown once before training: a read-only version of the exact picker
  // UI participants will use, with the correct answer already marked, plus a short explanation --
  // so the first time someone has to actually choose an answer themselves (training, right after
  // this), they've already seen what a good one looks like. Deliberately DIFFERENT objects from
  // TRAINING_ITEMS below (bow-tie/corkscrew vs. chair/ladle/fedora/backpack/wallet) so the examples
  // don't just hand participants the answer to an item they're about to be quizzed on. One example
  // has a single obvious answer (bow-tie/wear), the other has several valid answers (corkscrew's
  // wing lever/hold,push,lift) to illustrate that picking more than one is fine when more than one
  // genuinely applies.
  const ILLUSTRATIVE_EXAMPLES = [
    {
      object: "bow-tie",
      numbered_image: "images/bow-tie_numbered.png",
      highlight_image: "images/bow-tie_highlight_part1.png",
      part: 1,
      n_parts: 5,
      chosen: ["wear"],
      explanation:
        "This wing of the bow-tie is fabric you'd put around your neck, so <strong>\"wear\"</strong> " +
        "is the obvious functionality here. A single clear answer like this is totally fine. Just " +
        "remember it's about what the part DOES, not how it looks.",
    },
    {
      object: "corkscrew",
      numbered_image: "images/corkscrew_numbered.png",
      highlight_image: "images/corkscrew_highlight_part1.png",
      part: 1,
      n_parts: 19,
      chosen: ["hold", "push", "lift"],
      explanation:
        "This wing-shaped lever is what you'd <strong>hold</strong> onto and <strong>push</strong> " +
        "down to <strong>lift</strong> the cork out. When more than one functionality genuinely " +
        "applies, go ahead and pick up to 3 that fit, like here.",
    },
  ];
  const example_trials = ILLUSTRATIVE_EXAMPLES.map(function (item, i) {
    return {
      type: jsPsychHtmlButtonResponse,
      stimulus:
        `<div class="demo-banner">Example ${i + 1} of ${ILLUSTRATIVE_EXAMPLES.length}</div>` +
        `<div class="trial-container">` +
        build_training_images_block(item.numbered_image, item.highlight_image, item.part, item.n_parts) +
        build_example_answer_block(manifests[assignment[0].object].vocabulary, item.chosen, item.explanation) +
        `</div>`,
      choices: ["Continue"],
      data: { is_example: true, example_index: i },
    };
  });
  timeline.push(...example_trials);

  // ---- Training phase: 5 trials on known objects, same picker UI as the real task. ----
  const training_trials = TRAINING_ITEMS.map(function (item, i) {
    return {
      type: jsPsychHtmlButtonResponse,
      stimulus:
        `<div class="demo-banner">Training ${i + 1} of ${TRAINING_ITEMS.length}</div>` +
        `<div class="trial-container">` +
        build_training_images_block(item.numbered_image, item.highlight_image, item.part, item.n_parts) +
        build_functionality_picker_block(manifests[assignment[0].object].vocabulary) +
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
        <p>Now you'll do the same thing for a set of new objects, one at a time.</p>
      </div>
    `,
    choices: ["Begin"],
  };
  timeline.push(training_done);

  // ---- Main task: for each {object, size} in this session's assigned group, one elicitation trial
  // + one "imagine using it" trial per region, then one whole-object question -- before moving on to
  // the next object in the group. ----
  assignment.forEach(function (a, obj_index) {
    const object_name = a.object;
    const size_chart_scale = a.size;
    const manifest = manifests[object_name];
    const vocabulary = manifest.vocabulary;
    const regions = manifest.regions;
    const n_parts = regions.length;
    const regions_image = `images/${object_name}_numbered.png`;
    const size_chart_image = `images/${object_name}_${size_chart_scale}.png`;

    const object_intro = {
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div class="instructions-container">
          <h2>Object ${obj_index + 1} of ${assignment.length}</h2>
          <p>Here's a new object. You'll go through each of its parts the same way as before, then
          answer one question about the object as a whole.</p>
        </div>
      `,
      choices: ["Begin"],
    };
    timeline.push(object_intro);

    regions.forEach(function (row, i) {
      const functionality_trial = {
        type: jsPsychHtmlButtonResponse,
        stimulus:
          `<div class="demo-banner">Object ${obj_index + 1} of ${assignment.length}, region ${i + 1} of ${n_parts}</div>` +
          build_functionality_trial_html(
            regions_image,
            `images/${object_name}_highlight_part${row.part}.png`,
            size_chart_image,
            size_chart_scale,
            row.part,
            n_parts,
            vocabulary
          ),
        choices: ["Continue"],
        data: {
          object: object_name,
          size: size_chart_scale,
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
            `images/${object_name}_highlight_part${row.part}.png`,
            size_chart_image,
            size_chart_scale,
            row.part,
            n_parts
          ) +
          build_tool_use_block() +
          `</div>`,
        choices: ["Continue"],
        data: { object: object_name, part: row.part, is_tool_use: true },
        on_finish: function (data) {
          const interaction_box = document.querySelector("#tool-interaction-input");
          data.tool_interaction = interaction_box ? interaction_box.value.trim() : "";
        },
      };

      timeline.push({ timeline: [functionality_trial, tool_use_trial] });
    });

    // ---- After every part of this object has been answered individually, one final whole-object
    // question, before moving on to the next object in the group. ----
    const overall_trial = {
      type: jsPsychHtmlButtonResponse,
      stimulus:
        `<div class="demo-banner">Overall functionality for object ${obj_index + 1} of ${assignment.length}</div>` +
        `<div class="trial-container">` +
        `<p class="trial-caption" style="max-width:700px;margin:0 auto 20px;">` +
        `Now that you've looked at every part individually, step back and consider the object as a whole.` +
        `</p>` +
        build_overall_images_block(regions_image, size_chart_image, size_chart_scale, n_parts) +
        build_functionality_picker_block(vocabulary, "this object as a whole") +
        `</div>`,
      choices: ["Continue"],
      data: { object: object_name, size: size_chart_scale, is_overall: true },
      on_finish: function (data) {
        data.functionalities_selected = get_selected_functionalities();
      },
    };
    timeline.push(overall_trial);
  });

  const summary = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      const sections = assignment
        .map(function (a) {
          const object_name = a.object;
          const answered = jsPsych.data
            .get()
            .filter(function (t) {
              return (
                t.object === object_name &&
                t.functionalities_selected !== undefined &&
                !t.is_training &&
                !t.is_overall &&
                !t.is_tool_use
              );
            })
            .values();
          const overall = jsPsych.data.get().filter({ object: object_name, is_overall: true }).values()[0];

          const table_rows = answered
            .map(function (t) {
              const list = (t.functionalities_selected || []).map(escape_html).join(", ") || "&mdash;";
              return `<tr><td>${t.part}</td><td>${list}</td></tr>`;
            })
            .join("");
          const overall_list = overall
            ? (overall.functionalities_selected || []).map(escape_html).join(", ") || "&mdash;"
            : "&mdash;";

          return `
            <h3>${escape_html(object_name)} <span style="font-weight:400;color:#6b6b6b;">(${answered.length} parts)</span></h3>
            <table class="summary-table">
              <thead><tr><th>Part</th><th>Functionalities you picked</th></tr></thead>
              <tbody>${table_rows}</tbody>
            </table>
            <p style="margin:12px 0 28px;"><strong>Whole-object functionality:</strong> ${overall_list}</p>
          `;
        })
        .join("");

      return `
        <div class="demo-result">
          <h2>All ${assignment.length} objects answered</h2>
          ${sections}
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
    const tool_use_by_key = {};
    tool_uses.forEach(function (t) {
      tool_use_by_key[`${t.object}::${t.part}`] = {
        tool_interaction: t.tool_interaction,
        response_time_ms: t.rt,
      };
    });

    const objects_data = assignment.map(function (a) {
      const object_name = a.object;

      const region_data = jsPsych.data
        .get()
        .filter(function (t) {
          return (
            t.object === object_name &&
            t.functionalities_selected !== undefined &&
            !t.is_training &&
            !t.is_tool_use &&
            !t.is_overall
          );
        })
        .values()
        .map(function (t) {
          const tu = tool_use_by_key[`${t.object}::${t.part}`];
          return {
            part: t.part,
            region_id: t.region_id,
            model_labels: t.model_labels,
            functionalities_selected: t.functionalities_selected,
            response_time_ms: t.rt,
            tool_interaction: tu ? tu.tool_interaction : null,
            tool_use_response_time_ms: tu ? tu.response_time_ms : null,
          };
        });

      const overall_trial_data = jsPsych.data.get().filter({ object: object_name, is_overall: true }).values()[0];

      return {
        object: object_name,
        size_chart_scale: a.size,
        regions_image: `images/${object_name}_numbered.png`,
        overall_functionalities_selected: overall_trial_data ? overall_trial_data.functionalities_selected : [],
        overall_response_time_ms: overall_trial_data ? overall_trial_data.rt : null,
        regions: region_data,
      };
    });

    const results = {
      prolific_pid: prolific.prolific_pid || "",
      study_id: prolific.study_id,
      session_id: prolific.session_id,
      group_index: group_index,
      training: training_data,
      training_correct_count: training_correct_count,
      training_passed: training_passed,
      study_start_time: new Date(jsPsych.getStartTime()).toISOString(),
      study_end_time: new Date().toISOString(),
      total_duration_ms: jsPsych.getTotalTime(),
      objects: objects_data,
    };

    proliferate.submit(results);
  }

  jsPsych.run(timeline);
})();
