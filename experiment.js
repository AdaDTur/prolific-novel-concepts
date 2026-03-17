(async function () {
  const { trial_objects, group_index } = await loadTrialData();

  const practiceImages = {
    "dolphin": resolveImageURL("known/dolphin.png"),
    "corkscrew": resolveImageURL("known/corkscrew.png"),
    "golden-retriever": resolveImageURL("known/golden-retriever.png"),
    "rabbit": resolveImageURL("known/rabbit.png"),
    "rabbit-style": resolveImageURL("known/style/rabbit_11.png"),
  };

  // Five unique attention checks — each pairs two completely unrelated objects
  const attention_checks_def = [
    { base: "golden-retriever", perturbed: "corkscrew", word: "toma" },
    { base: "dolphin",          perturbed: "rabbit",    word: "blick" },
    { base: "rabbit",           perturbed: "corkscrew", word: "pon" },
    { base: "corkscrew",        perturbed: "golden-retriever", word: "neb" },
    { base: "dolphin",          perturbed: "rabbit",    word: "rav" },
  ];

  const prolific = get_prolific_params();

  const jsPsych = initJsPsych({
    show_progress_bar: true,
    auto_update_progress_bar: false,
    on_finish: function () {
      // Show the #thanks div so proliferate can update it with upload status
      document.getElementById("thanks").style.display = "";
      submit_results();
    },
  });

  let timeline = [];

  const preload = {
    type: jsPsychPreload,
    images: get_all_image_paths(trial_objects).concat(Object.values(practiceImages)),
    message: "Loading images... please wait.",
  };
  timeline.push(preload);

  const consent = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <p>
        <strong>You are invited to participate in a research study looking at human judgments of visual similarity.
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
        <li>Respond by clicking one of the seven buttons from
        <strong>"Strongly Disagree"</strong> to <strong>"Strongly Agree."</strong></li>
      </ol>
      <div class="note-box">
        <p><strong>A note on the images:</strong></p>
        <p>Some image pairs may look very similar, while others may look quite different.
        There are no right or wrong answers — we are interested in your honest judgment.
        Many of the image pairs will fall in a grey area, so don't hesitate to use the
        middle options on the scale when you're unsure.</p>
      </div>
      <p>Before the study begins, you will complete <strong>3 practice trials</strong>
      to make sure you understand the task. Then you will complete <strong>80 trials</strong>
      in total.</p>
    </div>
  `,
    choices: ["Continue to Practice"],
  };
  timeline.push(instructions);

  const likert_choices = [
    "Strongly Disagree",
    "Disagree",
    "Somewhat Disagree",
    "Neutral",
    "Somewhat Agree",
    "Agree",
    "Strongly Agree",
  ];

  const practice_1 = {
    timeline: [
      {
        type: jsPsychHtmlButtonResponse,
        stimulus:
          '<div class="practice-banner">Practice Trial 1 of 3</div>' +
          build_trial_html(
            practiceImages["dolphin"],
            practiceImages["dolphin"],
            "blicket"
          ),
        choices: likert_choices,
        data: { is_practice: true, practice_id: 1 },
        on_finish: function (data) {
          data.rating = data.response + 1;
          data.practice_correct = data.rating === 7;
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

  const practice_2 = {
    timeline: [
      {
        type: jsPsychHtmlButtonResponse,
        stimulus:
          '<div class="practice-banner">Practice Trial 2 of 3</div>' +
          build_trial_html(
            practiceImages["dolphin"],
            practiceImages["corkscrew"],
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

  const practice_3 = {
    timeline: [
      {
        type: jsPsychHtmlButtonResponse,
        stimulus:
          '<div class="practice-banner">Practice Trial 3 of 3</div>' +
          build_trial_html(
            practiceImages["rabbit"],
            practiceImages["rabbit-style"],
            "zup"
          ),
        choices: likert_choices,
        data: { is_practice: true, practice_id: 3 },
        on_finish: function (data) {
          data.rating = data.response + 1;
          data.practice_correct = data.rating >= 3 && data.rating <= 5;
        },
      },
      {
        timeline: [
          {
            type: jsPsychHtmlButtonResponse,
            stimulus: `
            <div class="practice-feedback">
              <h3>Not quite!</h3>
              <p>The two images show the <strong>same object with a noticeable change</strong>.
              It's not exactly the same, but it's not completely different either.</p>
              <p>For ambiguous cases like this, the middle options —
              <strong>"Somewhat Disagree," "Neutral,"</strong> or <strong>"Somewhat Agree"</strong>
              — are perfectly appropriate. Please select one of these.</p>
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
      const responses = data.filter({ is_practice: true, practice_id: 3 });
      const last = responses.last(1).values()[0];
      return !last.practice_correct;
    },
  };
  timeline.push(practice_3);

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

  let tv_array = create_tv_array(trial_objects);

  if (CONFIG.RANDOMIZE_TRIALS) {
    tv_array = shuffle_array(tv_array);
  }

  // Split 80 trials into 6 blocks with 5 attention checks between them
  const numChecks = CONFIG.NUM_ATTENTION_CHECKS;
  const blockSize = Math.floor(tv_array.length / (numChecks + 1));
  const remainder = tv_array.length % (numChecks + 1);

  let offset = 0;
  for (let b = 0; b <= numChecks; b++) {
    // Distribute remainder across the first blocks
    const thisBlockSize = blockSize + (b < remainder ? 1 : 0);
    const blockTrials = tv_array.slice(offset, offset + thisBlockSize);
    offset += thisBlockSize;

    // Push trial block
    if (blockTrials.length > 0) {
      timeline.push({
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
        timeline_variables: blockTrials,
      });
    }

    // Push attention check after every block except the last
    if (b < numChecks) {
      const ac = attention_checks_def[b];
      timeline.push({
        timeline: [
          {
            type: jsPsychHtmlButtonResponse,
            stimulus: build_trial_html(
              practiceImages[ac.base],
              practiceImages[ac.perturbed],
              ac.word
            ),
            choices: likert_choices,
            data: {
              is_attention_check: true,
              attention_check_index: b + 1,
              stimulus_id: "attention_check_" + (b + 1),
              base_image: practiceImages[ac.base],
              perturbed_image: practiceImages[ac.perturbed],
              novel_word: ac.word,
            },
            on_finish: function (data) {
              data.rating = data.response + 1;
            },
          },
        ],
      });
    }
  }

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

    const attention_data = jsPsych.data
      .get()
      .filter({ is_attention_check: true })
      .values()
      .sort(function (a, b) {
        return (a.attention_check_index || 0) - (b.attention_check_index || 0);
      });

    const survey_data = jsPsych.data
      .get()
      .filter({ trial_type: "survey" })
      .values();

    const feedback_response = survey_data.length > 0 ? survey_data[survey_data.length - 1].response : {};

    const results = {
      prolific_pid: prolific.prolific_pid || "",
      study_id: prolific.study_id,
      session_id: prolific.session_id,
      participant_group: group_index,
      study_start_time: new Date(jsPsych.getStartTime()).toISOString(),
      study_end_time: new Date().toISOString(),
      total_duration_ms: jsPsych.getTotalTime(),
      attention_checks: attention_data.map(function (ac) {
        return {
          index: ac.attention_check_index,
          stimulus_id: ac.stimulus_id,
          rating: ac.rating,
          response_time_ms: ac.rt,
        };
      }),
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

    proliferate.submit(results);
  }

  jsPsych.run(timeline);
})();
