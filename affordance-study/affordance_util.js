// Trial-HTML builders for the affordance-acceptability study, parallel to util.js's build_trial_html()
// in the main naming study: same two-image-box layout (trial-image-pair / trial-image-box /
// trial-image-frame classes, reused from ../experiment.css) -- just a different pair of images, a
// candidate-affordance list above them, and a different (comparative, not absolute) claim being rated.
//
//   regions_image    -- (a) the object partitioned into regions, each outlined and labelled by number
//                        (affordance_labeling.numbered_overlay() in the main NVRD repo)
//   highlight_image  -- (b) the same partition, with target_part at full brightness/outlined in
//                        magenta and every other region (and the background) dimmed -- same
//                        DIM_FACTOR + magenta-outline convention affordance_labeling.highlight_region()
//                        uses, just layered on top of the numbered colors so the numbering stays
//                        legible for cross-reference back to image (a)
//   target_part       -- the number of the highlighted region (must match its label in both images)
//   affordance        -- the affordance word the model picked for that region (from GAT / Aff-Grasp)
//   n_parts           -- total number of numbered regions, for the image (a) caption
//   candidate_list    -- the full set of affordances the model was choosing among (GAT's AFF_LIST);
//                        shown above the images with `affordance` visually distinguished as the
//                        model's pick, so "best explanation... over the other alternatives" has a
//                        concrete, visible set of alternatives to be read against

// The candidates list + both images, with no question/claim beneath it -- shared by the main rating
// trial and the "propose a better affordance" follow-up, so the follow-up still has the full visual
// context (the participant shouldn't have to recall the images/candidates from memory to answer it).
function build_affordance_stimulus_block(regions_image, highlight_image, target_part, affordance, n_parts, candidate_list) {
  const chips = candidate_list
    .map(function (c) {
      const chosen = c === affordance;
      return `<span class="candidate-chip${chosen ? " candidate-chosen" : ""}">${c}</span>`;
    })
    .join("");

  return `
    <div class="candidates-block">
      <div class="candidates-label">Possible affordances the AI model chose among for this object:</div>
      <div class="candidates-list">${chips}</div>
    </div>
    <div class="trial-image-pair">
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
          Of the affordances listed above, the AI model picked
          <span class="affordance-word">${affordance}</span> as the one that best explains what
          Part <span class="part-number">${target_part}</span> is used for.
        </div>
      </div>
    </div>
  `;
}

// Full rating-trial stimulus: the shared block above, plus the comparative claim being rated.
function build_affordance_trial_html(regions_image, highlight_image, target_part, affordance, n_parts, candidate_list) {
  return `
    <div class="trial-container">
      ${build_affordance_stimulus_block(regions_image, highlight_image, target_part, affordance, n_parts, candidate_list)}
      <div class="trial-question">
        The model's choice &mdash; <span class="affordance-word">${affordance}</span> &mdash; is the
        <strong>best</strong> explanation for Part <span class="part-number">${target_part}</span>'s
        function, compared to the other affordances listed above.
      </div>
    </div>
  `;
}

// The "imagine using it" probe shown after every region's rating (regardless of agreement/disagreement
// with the AI's label): (1) a free-text tool-use scenario -- what would this part interact with, and
// where/in what setting -- grounding the affordance judgment in a concrete imagined use rather than an
// abstract label; (2) the before/after states of that same imagined task, as two short structured
// fields (not one free-text narrative) since a fill-in-the-blank precondition/postcondition pair is
// easier for a participant to answer concretely and easier to analyze than parsing free narrative.
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
    <div class="state-block">
      <div class="state-label">(Optional) Now imagine that task happening:</div>
      <div class="state-inputs">
        <div class="state-input-group">
          <label for="before-state-input" class="reasoning-label">
            Before: what does the scene look like right before?
          </label>
          <input type="text" id="before-state-input" class="text-input"
            placeholder="e.g. the jar lid is stuck shut" />
        </div>
        <div class="state-input-group">
          <label for="after-state-input" class="reasoning-label">
            After: what does it look like once the task is done?
          </label>
          <input type="text" id="after-state-input" class="text-input"
            placeholder="e.g. the lid is off, jar is open" />
        </div>
      </div>
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
