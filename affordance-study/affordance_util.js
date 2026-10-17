// Trial-HTML builders for the affordance-study (internally "functionality" throughout the UI --
// most participants won't know the word "affordance", so every user-facing label, instruction and
// data field here says "functionality"/"functionalities" instead).
//
// This is the OPEN-ELICITATION version of the study: participants are never shown any model's
// guess for a part. Instead they pick their own answer(s) from a provided word bank (up to 3,
// click to toggle) or type one in if the bank doesn't have what they want. Each of the 4 VLMs'
// labels for a region are still recorded in the submitted data (model_labels, from the manifest's
// per-region `labels`), just never rendered -- they're there purely for offline comparison against
// what humans actually said, not to bias what humans say.
//
//   regions_image     -- (a) the object partitioned into regions, each outlined and labelled by number
//   highlight_image   -- (b) the same partition, with target_part at full brightness/outlined in
//                        magenta and every other region (and the background) dimmed
//   size_chart_image  -- (c) one of generate_size_charts.py's three human-silhouette scale charts for
//                        this object (hand/human/building) -- which one is picked once per session in
//                        demo.js, not per region
//   size_chart_scale  -- which of the three (c) is, for the caption wording
//   target_part       -- the number of the highlighted region (must match its label in both images)
//   n_parts           -- total number of numbered regions, for the image (a) caption
//   candidate_list    -- the functionality word bank to offer as clickable chips (manifest.vocabulary)

// The three images, with no picker/question beneath -- shared by every trial type (main elicitation
// trial, training trials) that needs this same visual context.
function build_functionality_images_block(regions_image, highlight_image, size_chart_image, size_chart_scale, target_part, n_parts) {
  return `
    <div class="trial-image-triple">
      <div class="trial-image-box">
        <div class="image-label">All Parts</div>
        <div class="trial-image-frame">
          <img src="${regions_image}" alt="Object divided into numbered parts" />
        </div>
        <div class="trial-caption">
          This object has been divided into <strong>${n_parts}</strong> numbered parts.
        </div>
      </div>
      <div class="trial-image-box">
        <div class="image-label">Highlighted Part</div>
        <div class="trial-image-frame">
          <img src="${highlight_image}" alt="One part highlighted, the rest dimmed" />
        </div>
        <div class="trial-caption">
          This is Part <span class="part-number">${target_part}</span>.
        </div>
      </div>
      <div class="trial-image-box">
        <div class="image-label">Size Reference</div>
        <div class="trial-image-frame size-chart-frame">
          <img src="${size_chart_image}" alt="Object silhouette next to a human figure for scale" />
        </div>
        <div class="trial-caption">
          One possible real-world size for this object, shown next to an average adult (${size_chart_scale} scale).
        </div>
      </div>
    </div>
  `;
}

// Shown once per object, after every part has been answered individually: the whole numbered
// object (no single part highlighted -- there's no "target part" for a whole-object judgment) plus
// the size-reference chart (size plausibly still matters for a whole-object functionality guess,
// e.g. "contain" means something very different at hand-scale vs. building-scale).
function build_overall_images_block(regions_image, size_chart_image, size_chart_scale, n_parts) {
  return `
    <div class="trial-image-pair">
      <div class="trial-image-box">
        <div class="image-label">All Parts</div>
        <div class="trial-image-frame">
          <img src="${regions_image}" alt="Object divided into numbered parts" />
        </div>
        <div class="trial-caption">
          This object has <strong>${n_parts}</strong> numbered parts in total.
        </div>
      </div>
      <div class="trial-image-box">
        <div class="image-label">Size Reference</div>
        <div class="trial-image-frame">
          <img src="${size_chart_image}" alt="Object silhouette next to a human figure for scale" />
        </div>
        <div class="trial-caption">
          One possible real-world size for this object, shown next to an average adult (${size_chart_scale} scale).
        </div>
      </div>
    </div>
  `;
}

// Training items use real, familiar objects (chair, ladle, fedora, backpack, wallet) whose
// real-world size isn't ambiguous the way a fictional novel object's is -- so just the two images,
// no size-reference chart (and none were generated for these training objects in the first place).
function build_training_images_block(numbered_image, highlight_image, target_part, n_parts) {
  return `
    <div class="trial-image-pair">
      <div class="trial-image-box">
        <div class="image-label">All Parts</div>
        <div class="trial-image-frame">
          <img src="${numbered_image}" alt="Object divided into numbered parts" />
        </div>
        <div class="trial-caption">
          This object has been divided into <strong>${n_parts}</strong> numbered parts.
        </div>
      </div>
      <div class="trial-image-box">
        <div class="image-label">Highlighted Part</div>
        <div class="trial-image-frame">
          <img src="${highlight_image}" alt="One part highlighted, the rest dimmed" />
        </div>
        <div class="trial-caption">
          This is Part <span class="part-number">${target_part}</span>.
        </div>
      </div>
    </div>
  `;
}

// A read-only version of the picker, used by the two illustrative examples shown before training:
// shows the SAME chip layout the real picker uses (so participants recognize the UI when they
// reach it themselves), but with the correct answer(s) already marked "selected" and no onclick --
// nothing to click, just what a good answer looks like -- plus a short explanation of why.
function build_example_answer_block(candidate_list, chosen, explanation) {
  const chosenLower = chosen.map(function (c) {
    return c.toLowerCase();
  });
  const chips = candidate_list
    .map(function (c) {
      const isChosen = chosenLower.indexOf(c.toLowerCase()) !== -1;
      return `<span class="candidate-chip${isChosen ? " selected" : ""}">${c}</span>`;
    })
    .join("");

  return `
    <div class="functionality-picker">
      <div class="candidates-label">
        <strong>Example answer.</strong> The highlighted word(s) below show what a good answer
        looks like for this part.
      </div>
      <div class="candidates-list">${chips}</div>
      <div class="note-box" style="margin-top:16px;text-align:left;">
        <p>${explanation}</p>
      </div>
    </div>
  `;
}

// The interactive word-bank picker: click a chip to select/deselect (max 3, enforced by
// toggle_functionality_chip below), or type something not in the list in the "other" box. Shared
// by the main per-part elicitation trial, the whole-object overall-functionality trial, and the
// training trials, so training is practice on the exact UI participants will use for real.
// `subject` is just the noun phrase in the instruction text ("this part" for a per-part trial,
// "this object as a whole" for the end-of-object overall trial) -- same picker/data mechanics either way.
function build_functionality_picker_block(candidate_list, subject) {
  subject = subject || "this part";
  const chips = candidate_list
    .map(function (c) {
      return `<span class="candidate-chip" data-value="${c}" onclick="toggle_functionality_chip(this)">${c}</span>`;
    })
    .join("");

  return `
    <div class="functionality-picker">
      <div class="candidates-label">
        Pick <strong>up to 3</strong> functionalities below that ${subject} could realistically be
        used for. Click a word to select or deselect it, or type your own in the box if something's
        missing. Just keep in mind <strong>"decoration," "looks nice," and stuff like that doesn't
        count</strong>, we want what it could actually be used to DO.
      </div>
      <div class="candidates-list">${chips}</div>
      <div class="other-functionality-block">
        <label for="other-functionality-input" class="reasoning-label">
          Other functionality not listed above (optional):
        </label>
        <input type="text" id="other-functionality-input" class="text-input"
          placeholder="e.g. prop open a door" />
      </div>
    </div>
  `;
}

// Click handler for candidate-chip toggling, referenced by the inline onclick= in the chips built
// above (plain global function, not a module export -- same pattern every other builder here uses,
// since this page has no bundler). Enforces the "up to 3" cap by simply ignoring a 4th selection
// attempt rather than bothering with a popup/alert.
function toggle_functionality_chip(el) {
  const container = el.closest(".candidates-list");
  const selectedCount = container.querySelectorAll(".candidate-chip.selected").length;
  if (el.classList.contains("selected")) {
    el.classList.remove("selected");
  } else if (selectedCount < 3) {
    el.classList.add("selected");
  }
}

// Reads back whatever the participant picked: selected chips' data-value, plus the free-text
// "other" box if non-empty. Called from on_finish for both training and main elicitation trials.
function get_selected_functionalities() {
  const chips = document.querySelectorAll(".candidate-chip.selected");
  const selected = Array.prototype.map.call(chips, function (c) {
    return c.dataset.value;
  });
  const otherBox = document.querySelector("#other-functionality-input");
  const other = otherBox ? otherBox.value.trim() : "";
  if (other) {
    selected.push(other);
  }
  return selected;
}

// Disables the Continue button until at least one functionality is selected (a chip or the "other"
// box), with a small hint explaining why -- called from on_load for every trial where answering is
// required (training, the per-part trial, the whole-object trial), never for the optional tool-use
// follow-up or the read-only illustrative examples. #jspsych-html-button-response-btngroup is
// jsPsych's own container for an html-button-response trial's buttons (see experiment.css), not
// something this page defines itself.
function require_functionality_before_continue(jsPsych) {
  const root = jsPsych.getDisplayElement();
  const btnGroup = root.querySelector("#jspsych-html-button-response-btngroup");
  const btn = btnGroup ? btnGroup.querySelector("button") : null;
  if (!btn) return;

  // Inserted after the whole button-group container, not after the button itself -- the group is
  // a flex row (see experiment.css), so a sibling of the button would end up squeezed beside it
  // instead of stacking underneath.
  const hint = document.createElement("div");
  hint.className = "required-hint";
  hint.textContent = "Pick at least one functionality above to continue.";
  btnGroup.insertAdjacentElement("afterend", hint);

  function check() {
    const satisfied = get_selected_functionalities().length > 0;
    btn.disabled = !satisfied;
    hint.style.display = satisfied ? "none" : "block";
  }

  root.querySelectorAll(".candidate-chip").forEach(function (chip) {
    chip.addEventListener("click", check);
  });
  const otherBox = root.querySelector("#other-functionality-input");
  if (otherBox) otherBox.addEventListener("input", check);

  check();
}

// Attention-check stimulus: the SAME images + chip grid as a real per-part trial (reusing a real
// region from whichever object this check is attached to, see demo.js), so it's structurally
// indistinguishable from an ordinary trial at a glance -- only the instruction text below the
// images differs, and even that is styled like the normal picker instructions rather than a
// callout box, so nothing about the layout tips off that this trial is different. No "other"
// free-text box, since there's nothing to volunteer here.
function build_attention_check_block(regions_image, highlight_image, size_chart_image, size_chart_scale, target_part, n_parts, candidate_list, target_words) {
  const chips = candidate_list
    .map(function (c) {
      return `<span class="candidate-chip" data-value="${c}" onclick="toggle_functionality_chip(this)">${c}</span>`;
    })
    .join("");

  return `
    ${build_functionality_images_block(regions_image, highlight_image, size_chart_image, size_chart_scale, target_part, n_parts)}
    <div class="functionality-picker">
      <div class="attention-check-instruction">
        Quick check: please click <strong>${target_words.join("</strong> and <strong>")}</strong>
        below (and nothing else), then click Continue.
      </div>
      <div class="candidates-list">${chips}</div>
    </div>
  `;
}

// Reads back an attention-check trial's selection the same way get_selected_functionalities() does
// (there's no "other" box here, so just the selected chips) and scores it against the target words
// -- passed if every target word was selected, extras aside (a participant clicking one honest extra
// word alongside the two instructed ones shouldn't fail them the way missing an instructed word should).
function score_attention_check(target_words) {
  const chips = document.querySelectorAll(".candidate-chip.selected");
  const selected = Array.prototype.map.call(chips, function (c) {
    return c.dataset.value.toLowerCase();
  });
  const targets_lower = target_words.map(function (w) {
    return w.toLowerCase();
  });
  return {
    selected: selected,
    passed: targets_lower.every(function (t) {
      return selected.indexOf(t) !== -1;
    }),
  };
}

// Full elicitation-trial stimulus: images + picker, for the main study trials.
function build_functionality_trial_html(regions_image, highlight_image, size_chart_image, size_chart_scale, target_part, n_parts, candidate_list) {
  return `
    <div class="trial-container">
      ${build_functionality_images_block(regions_image, highlight_image, size_chart_image, size_chart_scale, target_part, n_parts)}
      ${build_functionality_picker_block(candidate_list)}
    </div>
  `;
}

// The "imagine using it" probe shown after every elicitation trial: a free-text tool-use scenario
// -- what would this part interact with, and where/in what setting -- grounding the functionality
// judgment in a concrete imagined use rather than an abstract label. (Used to also ask for
// before/after states of that same imagined task as two structured fields; removed -- this single
// free-text prompt already captures what's needed, and the extra fields added length without
// adding signal.)
function build_tool_use_block() {
  return `
    <div class="tool-use-block">
      <label for="tool-interaction-input" class="reasoning-label">
        (Optional) Imagine someone uses this part as a tool to interact with something else. What would
        they use it to interact with, and in what setting or environment?
      </label>
      <textarea id="tool-interaction-input" class="text-input" rows="2"
        placeholder="e.g. prying open a stuck jar lid, in a kitchen"></textarea>
    </div>
  `;
}

// Identical to ../util.js's version -- duplicated here (rather than depending on ../util.js) so this
// folder stays self-contained if it's ever split into its own deployment.
function get_prolific_params() {
  const params = new URLSearchParams(window.location.search);
  return {
    prolific_pid: params.get("PROLIFIC_PID") || params.get("prolific_pid") || "",
    study_id: params.get("STUDY_ID") || params.get("study_id") || "",
    session_id: params.get("SESSION_ID") || params.get("session_id") || "",
  };
}
