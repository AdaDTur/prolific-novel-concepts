/**
 * experiment.js — jsPsych timeline for the Visual Concept Study
 *
 * Flow: Preload → Consent → Demographics → Instructions → 40 Trials (with
 * attention check at midpoint) → Feedback → Completion / redirect to Prolific.
 *
 * Following the jsPsych tutorial at:
 *   https://sebschu.com/web-based-experiments/tutorials/jsPsych/
 */

(async function () {
  // ---- Load trial data from manifest + assignments ----
  const { trial_objects, group_index } = await loadTrialData();

  // ---- Practice & attention check image URLs ----
  const practiceImages = {
    "humpback-whale": resolveImageURL("known/humpback-whale.png"),
    "chair": resolveImageURL("known/chair.png"),
    "golden-retriever": resolveImageURL("known/golden-retriever.png"),
    "corkscrew": resolveImageURL("known/corkscrew.png"),
  };

  // ---- Prolific params ----
  const prolific = get_prolific_params();

  // ---- Init jsPsych ----
  const jsPsych = initJsPsych({
    show_progress_bar: true,
    auto_update_progress_bar: false,
    on_finish: function () {
      submit_results();
    },
  });

  let timeline = [];

  // ========== 1. Preload images ==========
  // Include practice and attention-check images alongside trial images
  const preload = {
    type: jsPsychPreload,
    images: get_all_image_paths(trial_objects).concat(Object.values(practiceImages)),
    message: "Loading images... please wait.",
  };
  timeline.push(preload);

  // ========== 2. Consent ==========
  const consent = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <p>
        <strong>You are invited to participate in a research study looking at the preferences of humans for constituent movement.
        Please read this form carefully and ask any questions you may have before agreeing to take part in the study.</strong>
        <br>
        <br>
        <strong>Investigators: </strong>Dr. Siva Reddy (Assistant Professor of Linguistics and Computer Science at McGill University),
        and students and research assistants under Dr. Reddy.
        <br>
        <br>
        <strong>What this study is about: </strong>The purpose of this study is to investigate whether vision-language AI systems show similar
        judgements to humans on novel visual concepts.
        This is investigated in terms of various visual attributes of images, AI system judgements on such data,
        and how these compare to human judgments.
        <br>
        <br>
        <strong>Use of your data: </strong>The data collected in this study will be stored on a secure server and on a cloud-storage service (either Google Drive or Dropbox).
        Your Prolific ID will not be directly linked to your data but will be stored separately (we only store the session ID). We will delete the separately stored Prolific ID from our files within 1 year at the latest.
        <br>
        The data we collect may also be used to illustrate the results of the research results in an online interactive site.
        The anonymized data may also be published as part of an anonymous corpus distributed for further research. By consenting to releasing your data as a corpus, you will help ensure that your contribution will have a more lasting impact.
        <br>
        <br>
        <strong>Taking part is voluntary: </strong>Your participation is completely voluntary. You are free to withdraw consent and discontinue participation in the project at any time without penalty.
        However, data cannot be withdrawn after the information linking your Prolific ID to your data has been deleted.
        <br>
        <br>
        <strong>If you have any questions: </strong>You can contact Ada Tur (email: ada.tur@mail.mcgill.ca), undergraduate student under Dr. Siva Reddy, with any questions about this study.
        <br>
        <strong>STATEMENT OF CONSENT: </strong><i>To give your consent, please read the statement below, and click on it. If you do not consent, then you can just close the browser window now, your data will not be kept on file.
        Please print this page if you want to keep a record of this information!</i>
      </p>
    `,
    choices: ["I consent to participate"],
  };
  timeline.push(consent);

  // ========== 2b. Demographics survey (moved before instructions) ==========
  const demographics = {
    type: jsPsychSurvey,
    title: "About You",
    pages: [
      [
        {
          type: "html",
          prompt:
            "<p>Please answer a few brief questions before we begin. All fields are optional but help us analyze our results.</p>",
        },
        {
          type: "text",
          prompt: "Prolific ID (if not auto-filled):",
          name: "prolific_id",
          textbox_columns: 30,
          required: false,
        },
        {
          type: "text",
          prompt: "Age:",
          name: "age",
          textbox_columns: 10,
          required: false,
        },
        {
          type: "drop-down",
          prompt: "Gender:",
          name: "gender",
          options: [
            "Female",
            "Male",
            "Non-binary",
            "Other",
            "Prefer not to say",
          ],
          required: false,
        },
        {
          type: "drop-down",
          prompt: "Native language:",
          name: "native_language",
          options: [
            "English",
            "French",
            "Spanish",
            "Mandarin",
            "Hindi",
            "Arabic",
            "Other",
          ],
          required: false,
        },
        {
          type: "drop-down",
          prompt: "Highest level of education:",
          name: "education",
          options: [
            "High school or equivalent",
            "Some college",
            "Bachelor's degree",
            "Master's degree",
            "Doctorate",
            "Other",
          ],
          required: false,
        },
      ],
    ],
  };
  timeline.push(demographics);

  // ========== 3. Instructions ==========
  const instructions = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
    <div class="instructions-container">
      <h2>Instructions</h2>
      <p>In this study, you will be shown pairs of images. Here is what to expect on each screen:</p>
      <ol>
        <li>You will see two images side by side. The <strong>left image</strong> is the
        original and the <strong>right image</strong> is a variation of it.</li>
        <li>The object in the left image will be given a <strong>made-up name</strong>
        (for example, <em>"dax"</em>). This is a new word — it does not have a real meaning.</li>
        <li>Your task is to judge whether the object in the <strong>right image</strong>
        could also be called by the same made-up name.</li>
        <li>Respond by clicking one of the five buttons from
        <strong>"Strongly Disagree"</strong> to <strong>"Strongly Agree."</strong></li>
      </ol>
      <div class="note-box">
        <p><strong>A note on the images:</strong></p>
        <p>Some image pairs may look very similar, while others may look quite different.
        There are no right or wrong answers — we are interested in your honest judgment.</p>
      </div>
      <p>Before the study begins, you will complete <strong>2 practice trials</strong>
      to make sure you understand the task. Then you will complete <strong>40 trials</strong>
      in total.</p>
    </div>
  `,
    choices: ["Continue to Practice"],
  };
  timeline.push(instructions);

  // ========== 3b. Practice trials ==========
  const likert_choices = [
    "Strongly Disagree",
    "Somewhat Disagree",
    "Neutral",
    "Somewhat Agree",
    "Strongly Agree",
  ];

  // Practice 1: Identical images — must choose "Strongly Agree"
  const practice_1 = {
    timeline: [
      {
        type: jsPsychHtmlButtonResponse,
        stimulus:
          '<div class="practice-banner">Practice Trial 1 of 2</div>' +
          build_trial_html(
            practiceImages["humpback-whale"],
            practiceImages["humpback-whale"],
            "blicket"
          ),
        choices: likert_choices,
        data: { is_practice: true, practice_id: 1 },
        on_finish: function (data) {
          data.rating = data.response + 1;
          data.practice_correct = data.rating === 5;
        },
      },
      {
        timeline: [
          {
            type: jsPsychHtmlButtonResponse,
            stimulus: `
            <div class="practice-feedback">
              <h3>Not quite!</h3>
              <p>The two images are <strong>identical</strong> — they show the exact
              same object. Since nothing has changed, the object on the right is
              definitely still a "blicket."</p>
              <p>Please select <strong>"Strongly Agree."</strong></p>
            </div>
          `,
            choices: ["Try Again"],
          },
        ],
        conditional_function: function () {
          const last = jsPsych.data.get().last(1).values()[0];
          return !last.practice_correct;
        },
      },
    ],
    loop_function: function (data) {
      const responses = data.filter({ is_practice: true, practice_id: 1 });
      const last = responses.last(1).values()[0];
      return !last.practice_correct;
    },
  };
  timeline.push(practice_1);

  // Practice 2: Entirely unrelated images — must choose "Strongly Disagree"
  const practice_2 = {
    timeline: [
      {
        type: jsPsychHtmlButtonResponse,
        stimulus:
          '<div class="practice-banner">Practice Trial 2 of 2</div>' +
          build_trial_html(
            practiceImages["humpback-whale"],
            practiceImages["chair"],
            "wug"
          ),
        choices: likert_choices,
        data: { is_practice: true, practice_id: 2 },
        on_finish: function (data) {
          data.rating = data.response + 1;
          data.practice_correct = data.rating === 1;
        },
      },
      {
        timeline: [
          {
            type: jsPsychHtmlButtonResponse,
            stimulus: `
            <div class="practice-feedback">
              <h3>Not quite!</h3>
              <p>The two images show <strong>completely different objects</strong>.
              The object on the right is entirely unrelated to the original, so it
              would not be called by the same name.</p>
              <p>Please select <strong>"Strongly Disagree."</strong></p>
            </div>
          `,
            choices: ["Try Again"],
          },
        ],
        conditional_function: function () {
          const last = jsPsych.data.get().last(1).values()[0];
          return !last.practice_correct;
        },
      },
    ],
    loop_function: function (data) {
      const responses = data.filter({ is_practice: true, practice_id: 2 });
      const last = responses.last(1).values()[0];
      return !last.practice_correct;
    },
  };
  timeline.push(practice_2);

  // Transition from practice to real study
  const practice_done = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
    <div class="practice-done-container">
      <h2>Practice Complete</h2>
      <p>Great — you're ready for the real study!</p>
      <p>Remember, in the actual trials there are no right or wrong answers.
      We are interested in your honest judgment about whether the variation
      could be called by the same name as the original.</p>
    </div>
  `,
    choices: ["Begin Study"],
  };
  timeline.push(practice_done);

  // ========== 4. Build trial timeline variables ==========
  let tv_array = create_tv_array(trial_objects);

  // Optionally randomize
  if (CONFIG.RANDOMIZE_TRIALS) {
    tv_array = shuffle_array(tv_array);
  }

  // Split trials around the attention check
  const attention_index = CONFIG.ATTENTION_CHECK_AFTER;
  const trials_before = tv_array.slice(0, attention_index);
  const trials_after = tv_array.slice(attention_index);

  // ---- Trial block (first half) ----
  const trials_block_1 = {
    timeline: [
      {
        type: jsPsychHtmlButtonResponse,
        stimulus: jsPsych.timelineVariable("stimulus"),
        choices: likert_choices,
        data: jsPsych.timelineVariable("data"),
        on_finish: function (data) {
          data.rating = data.response + 1;
          const total = trial_objects.length;
          const completed_trials = jsPsych.data
            .get()
            .filter(function (trial) {
              return (
              trial.rating !== undefined &&
              !trial.is_practice &&
              !trial.is_attention_check
            );
            })
            .count();
          jsPsych.setProgressBar(completed_trials / total);
        },
      },
    ],
    timeline_variables: trials_before,
  };
  timeline.push(trials_block_1);

  // ========== 5. Attention check (at midpoint) ==========
  // Presented as a normal-looking trial with completely unrelated images.
  // Attentive participants should strongly disagree. Checked post-hoc.
  const attention_check = {
    timeline: [
      {
        type: jsPsychHtmlButtonResponse,
        stimulus: build_trial_html(
          practiceImages["golden-retriever"],
          practiceImages["corkscrew"],
          "toma"
        ),
        choices: likert_choices,
        data: {
          is_attention_check: true,
          stimulus_id: "attention_check",
          base_image: practiceImages["golden-retriever"],
          perturbed_image: practiceImages["corkscrew"],
          novel_word: "toma",
        },
        on_finish: function (data) {
          data.rating = data.response + 1;
        },
      },
    ],
  };
  timeline.push(attention_check);

  // ---- Trial block (second half) ----
  const trials_block_2 = {
    timeline: [
      {
        type: jsPsychHtmlButtonResponse,
        stimulus: jsPsych.timelineVariable("stimulus"),
        choices: likert_choices,
        data: jsPsych.timelineVariable("data"),
        on_finish: function (data) {
          data.rating = data.response + 1;
          const total = trial_objects.length;
          const completed_trials = jsPsych.data
            .get()
            .filter(function (trial) {
              return (
              trial.rating !== undefined &&
              !trial.is_practice &&
              !trial.is_attention_check
            );
            })
            .count();
          jsPsych.setProgressBar(completed_trials / total);
        },
      },
    ],
    timeline_variables: trials_after,
  };
  timeline.push(trials_block_2);

  // ========== 6. Feedback survey ==========
  const feedback_survey = {
    type: jsPsychSurvey,
    title: "Almost Done!",
    pages: [
      [
        {
          type: "text",
          prompt: "Any feedback on this study?",
          name: "feedback",
          textbox_columns: 40,
          textbox_rows: 3,
          required: false,
        },
      ],
    ],
  };
  timeline.push(feedback_survey);

  // ========== 7. Completion screen ==========
  const completion = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
    <div class="completion-container">
      <div class="completion-icon">&#10003;</div>
      <h2>Thank You!</h2>
      <p>Your responses have been recorded successfully.</p>
      <p class="muted">Click below to return to Prolific and complete the study.</p>
    </div>
  `,
    choices: ["Return to Prolific"],
    on_finish: function () {
      if (
        CONFIG.PROLIFIC_COMPLETION_URL &&
        !CONFIG.PROLIFIC_COMPLETION_URL.includes("YOUR_COMPLETION_CODE")
      ) {
        window.location.href = CONFIG.PROLIFIC_COMPLETION_URL;
      }
    },
  };
  timeline.push(completion);

  // ========== Data submission ==========
  function submit_results() {
    // Real trials (exclude practice and attention check)
    const trial_data = jsPsych.data
      .get()
      .filter(function (trial) {
        return (
          trial.rating !== undefined &&
          !trial.is_practice &&
          !trial.is_attention_check
        );
      })
      .values();

    // Attention check trial (unrelated image pair — check rating post-hoc)
    const attention_data = jsPsych.data
      .get()
      .filter({ is_attention_check: true })
      .values();

    const survey_data = jsPsych.data
      .get()
      .filter({ trial_type: "survey" })
      .values();

    // First survey is demographics (at start), last is feedback (at end)
    const demo_response = survey_data.length > 0 ? survey_data[0].response : {};
    const feedback_response = survey_data.length > 1 ? survey_data[survey_data.length - 1].response : {};

    const results = {
      prolific_pid: prolific.prolific_pid || (demo_response.prolific_id || ""),
      study_id: prolific.study_id,
      session_id: prolific.session_id,
      participant_group: group_index,
      study_start_time: new Date(jsPsych.getStartTime()).toISOString(),
      study_end_time: new Date().toISOString(),
      total_duration_ms: jsPsych.getTotalTime(),
      attention_check:
        attention_data.length > 0
          ? {
              rating: attention_data[0].rating,
              response_time_ms: attention_data[0].rt,
            }
          : null,
      demographics: demo_response,
      feedback: feedback_response.feedback || "",
      trials: trial_data.map(function (t) {
        return {
          stimulus_id: t.stimulus_id,
          category: t.category,
          edit_type: t.edit_type,
          level: t.level,
          novel_word: t.novel_word,
          base_image: t.base_image,
          perturbed_image: t.perturbed_image,
          rating: t.rating,
          response_time_ms: t.rt,
        };
      }),
    };

    if (CONFIG.RESULTS_ENDPOINT) {
      fetch(CONFIG.RESULTS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(results),
      }).catch(function (err) {
        console.error("Save failed, downloading locally:", err);
        download_json(
          results,
          "results_" +
            (prolific.prolific_pid || "local") +
            "_" +
            Date.now() +
            ".json"
        );
      });
    } else {
      download_json(
        results,
        "results_" +
          (prolific.prolific_pid || "local") +
          "_" +
          Date.now() +
          ".json"
      );
    }
  }

  // ========== Run ==========
  jsPsych.run(timeline);
})();
