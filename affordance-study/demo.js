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
// Results go to a Google Sheet (Apps Script web app, one row per participant: received_at,
// participant, group, results_json) instead of Proliferate, so labmates can take the study from a
// plain link with no Prolific account. Link format: index.html?GROUP=<0-8>&ID=<name or initials>.
const SHEET_URL =
  "https://script.google.com/macros/s/AKfycbywIgg7tMNJVidcxyG25I9tU15H0CYPm_BQvs_DGCQIvBmGtjBsiIClNdRVg9ZNy9W5Rw/exec";

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
  const participant_id = new URLSearchParams(window.location.search).get("ID") || "";
  // ?DESC=1 shows each object's physical-properties description (manifest "description": material,
  // surface, rigidity, edges; never function) as a card above its images. Off by default, so the
  // same link without DESC is the no-description condition.
  const SHOW_DESC = new URLSearchParams(window.location.search).get("DESC") === "1";
  function desc_card(object_name) {
    const d = SHOW_DESC && manifests[object_name] && manifests[object_name].description;
    return d ? `<div class="desc-card"><span class="desc-label">About this object</span> ${escape_html(d)}</div>` : "";
  }

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
  // Region ids (and so part numbers/n_parts) were re-picked after switching region generation
  // from SAM1(vit_b)+SLIC to SAM2 -- see generate_training_images.py in the main NVRD repo for
  // the exact region_id each maps to and how each was verified.
  // Cut from 5 items down to 1 (chair) -- training was taking too long and a lot of participants
  // were failing it on earlier rounds, so this keeps just the clearest, least ambiguous item
  // (a single accepted answer, "sit on") rather than something borderline like the old
  // backpack/wallet items with 4 acceptable synonyms each. The other 4 items (ladle, fedora,
  // backpack, wallet) are left here, commented out, in case the pass-rate issue turns out to be
  // about item count rather than item difficulty and they're needed again.
  const TRAINING_ITEMS = [
    {
      object: "chair",
      numbered_image: "images/chair_numbered.png",
      highlight_image: "images/chair_highlight_part2.png",
      part: 2,
      n_parts: 7,
      accepted: ["sit on"],
    },
    // {
    //   object: "ladle",
    //   numbered_image: "images/ladle_numbered.png",
    //   highlight_image: "images/ladle_highlight_part2.png",
    //   part: 2,
    //   n_parts: 3,
    //   accepted: ["scoop", "stir", "contain", "pour"],
    // },
    // {
    //   object: "fedora",
    //   numbered_image: "images/fedora_numbered.png",
    //   highlight_image: "images/fedora_highlight_part1.png",
    //   part: 1,
    //   n_parts: 6,
    //   accepted: ["wear"],
    // },
    // {
    //   object: "backpack",
    //   numbered_image: "images/backpack_numbered.png",
    //   highlight_image: "images/backpack_highlight_part1.png",
    //   part: 1,
    //   n_parts: 12,
    //   accepted: ["carry", "contain", "hold", "open"],
    // },
    // {
    //   object: "wallet",
    //   numbered_image: "images/wallet_numbered.png",
    //   highlight_image: "images/wallet_highlight_part1.png",
    //   part: 1,
    //   n_parts: 2,
    //   accepted: ["open", "contain", "hold", "carry"],
    // },
  ];
  // With a single training item there's no "miss one, still pass" room left -- it has to be
  // answered correctly. TRAINING_ITEMS.length (not a literal 5) so this still makes sense if items
  // are ever added back above.
  const TRAINING_PASS_THRESHOLD = TRAINING_ITEMS.length;

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
        by Ada Tur (adadt2@illinois.edu). We're looking at how
        AI vision-language models learn what novel, made-up objects could be used for, and comparing
        that to how humans figure out the same thing just by looking. Your answers help us see where
        these models line up with human judgment and where they don't.</p>
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
        like, then do <strong>1 short training round</strong> on an everyday object (a chair) to get
        the hang of it before moving on to the real task.</p>
      </div>
    `,
    choices: ["Begin Training"],
  };

  const timeline = [research_info, intro];

  // ---- Two worked examples, shown once before training: a read-only version of the exact picker
  // UI participants will use, with the correct answer already marked, plus a short explanation --
  // so the first time someone has to actually choose an answer themselves (training, right after
  // this), they've already seen what a good one looks like. Both use coffee-table (not one of
  // TRAINING_ITEMS below, so the examples don't hand participants the answer to an item they're
  // about to be quizzed on), two different parts of it -- it's the only one of the unused known
  // objects whose SAM segmentation actually came out clean; clock and fire-alarm both fragmented
  // into dozens of tiny regions around their text/numerals and weren't usable. The tabletop has
  // several valid answers (hold, sit on), the lower shelf has one obvious answer (hold), covering
  // both cases the same way the earlier bow-tie/corkscrew pair did.
  const ILLUSTRATIVE_EXAMPLES = [
    {
      object: "coffee-table",
      numbered_image: "images/coffee-table_numbered.png",
      highlight_image: "images/coffee-table_highlight_part1.png",
      part: 1,
      n_parts: 7,
      chosen: ["hold", "sit on"],
      explanation:
        "This tabletop could <strong>hold</strong> things you set on it, and people also " +
        "<strong>sit on</strong> coffee tables sometimes. When more than one functionality " +
        "genuinely applies, go ahead and pick up to 3 that fit, like here.",
    },
    {
      object: "coffee-table",
      numbered_image: "images/coffee-table_numbered.png",
      highlight_image: "images/coffee-table_highlight_part2.png",
      part: 2,
      n_parts: 7,
      chosen: ["hold"],
      explanation:
        "This lower shelf is mainly there to <strong>hold</strong> things like magazines or " +
        "remotes. A single clear answer like this is totally fine to give.",
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

  // ---- Training phase: 1 trial on a known object, same picker UI as the real task. ----
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
      on_load: function () {
        require_functionality_before_continue(jsPsych);
      },
      on_finish: function (data) {
        data.training_correct = training_item_correct(item, data.functionalities_selected || []);
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

  // ---- Main task, as ONE navigable sequence of pages with Back / Next buttons so participants can
  // revisit and change earlier answers. jsPsych has no built-in "go back a trial", so the whole main
  // task is a single html-button-response trial in a loop: `pages` (built once, below) holds every
  // page's HTML and metadata, `cur` is the page on screen, and `answers[i]` holds page i's live answer
  // (restored into the chips / text boxes whenever the page is shown again). Next stays disabled until
  // the page is answered, and the run ends on a review page whose Submit button stays disabled while
  // any question is unanswered, so nobody can submit an incomplete session. Results are read from
  // `answers` at submit time, not from jsPsych's per-trial data (a page visited 3 times has 3 rows).

  const pages = [];
  assignment.forEach(function (a, obj_index) {
    const object_name = a.object;
    const size_chart_scale = a.size;
    const manifest = manifests[object_name];
    const vocabulary = manifest.vocabulary;
    const regions = manifest.regions;
    const n_parts = regions.length;
    const regions_image = `images/${object_name}_numbered.png`;
    const size_chart_image = `images/${object_name}_${size_chart_scale}.png`;

    pages.push({
      kind: "intro",
      object: object_name,
      html: `
        <div class="instructions-container">
          <h2>Object ${obj_index + 1} of ${assignment.length}</h2>
          <p>Here's a new object. You'll go through each of its parts the same way as before, then
          answer one question about the object as a whole. You can use <strong>Back</strong> at any
          point to change an earlier answer.</p>
          ${desc_card(object_name)}
        </div>
      `,
    });

    regions.forEach(function (row, i) {
      const options = row.bank || vocabulary;
      pages.push({
        kind: "part",
        required: true,
        object: object_name,
        size: size_chart_scale,
        part: row.part,
        region_id: row.region_id,
        model_labels: row.labels, // recorded for later comparison, never shown to the participant
        options: options,
        html:
          `<div class="demo-banner">Object ${obj_index + 1} of ${assignment.length}, region ${i + 1} of ${n_parts}</div>` +
          desc_card(object_name) +
          build_functionality_trial_html(
            regions_image,
            `images/${object_name}_highlight_part${row.part}.png`,
            size_chart_image,
            size_chart_scale,
            row.part,
            n_parts,
            options
          ),
      });
    });

    const overall_options = manifest.overall_bank || vocabulary;
    pages.push({
      kind: "overall",
      required: true,
      object: object_name,
      size: size_chart_scale,
      options: overall_options,
      html:
        `<div class="demo-banner">Overall functionality for object ${obj_index + 1} of ${assignment.length}</div>` +
        desc_card(object_name) +
        `<div class="trial-container">` +
        `<p class="trial-caption" style="max-width:700px;margin:0 auto 20px;">` +
        `Now that you've looked at every part individually, step back and consider the object as a whole.` +
        `</p>` +
        build_overall_images_block(regions_image, size_chart_image, size_chart_scale, n_parts) +
        build_functionality_picker_block(overall_options, "this object as a whole") +
        `</div>`,
    });
  });
  pages.push({ kind: "review" });

  const answers = pages.map(function () {
    return { selected: [], tool: "", rt_ms: 0, visits: 0 };
  });
  function unanswered_pages() {
    return pages
      .map(function (p, i) { return i; })
      .filter(function (i) { return pages[i].required && answers[i].selected.length === 0; });
  }

  function build_review_html() {
    const missing = unanswered_pages();
    const sections = assignment
      .map(function (a) {
        const rows = pages
          .map(function (p, i) { return { p: p, i: i }; })
          .filter(function (x) { return x.p.object === a.object && x.p.kind === "part"; })
          .map(function (x) {
            const sel = answers[x.i].selected;
            const list = sel.length ? sel.map(escape_html).join(", ") : `<span style="color:#b00020;">not answered</span>`;
            return `<tr><td>${x.p.part}</td><td>${list}</td></tr>`;
          })
          .join("");
        const oi = pages.findIndex(function (p) { return p.object === a.object && p.kind === "overall"; });
        const osel = answers[oi].selected;
        const olist = osel.length ? osel.map(escape_html).join(", ") : `<span style="color:#b00020;">not answered</span>`;
        return `
          <h3>Object ${assignment.indexOf(a) + 1}</h3>
          <table class="summary-table">
            <thead><tr><th>Part</th><th>Functionalities you picked</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin:12px 0 28px;"><strong>Whole-object functionality:</strong> ${olist}</p>
        `;
      })
      .join("");
    const note = missing.length
      ? `<p style="color:#b00020;"><strong>${missing.length} question${missing.length > 1 ? "s are" : " is"} still unanswered.</strong> Use Back to go to ${missing.length > 1 ? "them" : "it"}; you can submit once everything is answered.</p>`
      : `<p>Everything is answered. Use <strong>Back</strong> if you want to change anything, or <strong>Submit</strong> to finish.</p>`;
    return `
      <div class="demo-result">
        <h2>Review your answers</h2>
        ${note}
        ${sections}
      </div>
    `;
  }

  let cur = 0;
  let shown = 0;
  const nav_trial = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      return pages[cur].kind === "review" ? build_review_html() : pages[cur].html;
    },
    choices: function () {
      const forward = pages[cur].kind === "review" ? "Submit" : "Next";
      return cur > 0 ? ["Back", forward] : [forward];
    },
    on_start: function () {
      shown = cur;
    },
    on_load: function () {
      window.scrollTo(0, 0);
      const p = pages[shown];
      const a = answers[shown];
      const root = jsPsych.getDisplayElement();
      const btns = root.querySelectorAll("#jspsych-html-button-response-btngroup button");
      const forward_btn = btns[btns.length - 1];
      const btn_group = root.querySelector("#jspsych-html-button-response-btngroup");

      if (p.kind === "review") {
        forward_btn.disabled = unanswered_pages().length > 0;
        return;
      }

      // Restore this page's saved answer: chips by value, anything else into the "other" box.
      const chips = root.querySelectorAll(".candidate-chip");
      const chip_values = Array.prototype.map.call(chips, function (c) { return c.dataset.value; });
      chips.forEach(function (c) {
        if (a.selected.indexOf(c.dataset.value) !== -1) c.classList.add("selected");
      });
      const other_box = root.querySelector("#other-functionality-input");
      if (other_box) {
        other_box.value = a.selected.filter(function (v) { return chip_values.indexOf(v) === -1; }).join(", ");
      }
      const tool_box = root.querySelector("#tool-interaction-input");
      if (tool_box) {
        tool_box.value = a.tool;
        tool_box.addEventListener("input", function () {
          a.tool = tool_box.value.trim();
        });
      }

      if (!p.required) return;
      const hint = document.createElement("div");
      hint.className = "required-hint";
      hint.textContent = "Pick at least one functionality above to continue.";
      btn_group.insertAdjacentElement("afterend", hint);
      function check() {
        a.selected = get_selected_functionalities();
        const ok = a.selected.length > 0;
        forward_btn.disabled = !ok; // Back always stays enabled
        hint.style.display = ok ? "none" : "block";
      }
      chips.forEach(function (c) { c.addEventListener("click", check); });
      if (other_box) other_box.addEventListener("input", check);
      check();
    },
    on_finish: function (data) {
      const a = answers[shown];
      a.rt_ms += data.rt;
      a.visits += 1;
      data.is_nav = true;
      data.page_index = shown;
      data.page_kind = pages[shown].kind;
      const went_back = shown > 0 && data.response === 0;
      if (went_back) cur = shown - 1;
      else if (pages[shown].kind === "review") cur = pages.length; // Submit
      else cur = shown + 1;
    },
  };
  timeline.push({
    timeline: [nav_trial],
    loop_function: function () {
      return cur < pages.length;
    },
  });

  const thanks = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <div class="practice-done-container">
        <h2>Thank you!</h2>
        <p id="save-status">Saving your answers... please keep this tab open.</p>
      </div>
    `,
    choices: [],
    on_load: function () {
      submit_results();
    },
  };
  timeline.push(thanks);

  let submitted = false; // on_finish and the thanks trial can both call submit_results(); send once
  function submit_results() {
    if (submitted) return;
    submitted = true;
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

    // Main-task answers come from `answers` (final state of each page after any Back/Next edits);
    // response_time_ms sums every visit to that page, visits counts them (>1 = revisited/edited).
    const objects_data = assignment.map(function (a) {
      const object_name = a.object;
      const region_data = pages
        .map(function (p, i) { return { p: p, a: answers[i] }; })
        .filter(function (x) { return x.p.object === object_name && x.p.kind === "part"; })
        .map(function (x) {
          return {
            part: x.p.part,
            region_id: x.p.region_id,
            model_labels: x.p.model_labels,
            options_shown: x.p.options,
            functionalities_selected: x.a.selected,
            response_time_ms: x.a.rt_ms,
            visits: x.a.visits,
            tool_interaction: x.a.tool || null,
          };
        });
      const oi = pages.findIndex(function (p) { return p.object === object_name && p.kind === "overall"; });
      return {
        object: object_name,
        size_chart_scale: a.size,
        regions_image: `images/${object_name}_numbered.png`,
        overall_options_shown: pages[oi].options,
        overall_functionalities_selected: answers[oi].selected,
        overall_response_time_ms: answers[oi].rt_ms,
        overall_visits: answers[oi].visits,
        regions: region_data,
      };
    });

    const results = {
      participant_id: participant_id,
      descriptions_shown: SHOW_DESC,
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
    // One row per participant in the Google Sheet; its results_json cell is this whole object, so
    // the full_results_json copy the Proliferate version added (a workaround for Proliferate's
    // one-CSV-per-key export) is not needed, and leaving it out keeps the cell well under Google
    // Sheets' 50,000-character limit. mode "no-cors" + text/plain: Apps Script can't answer a CORS
    // preflight, and the response is opaque, so a resolved fetch means the request was delivered.
    const status = () => document.getElementById("save-status");
    fetch(SHEET_URL, {
      method: "POST",
      mode: "no-cors",
      keepalive: true,
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ participant: participant_id || "(no ID)", group: group_index, results: results }),
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
