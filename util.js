function create_tv_array(trial_objs) {
  let tv_array = [];
  for (let i = 0; i < trial_objs.length; i++) {
    let obj = {};
    obj.stimulus = build_trial_html(
      trial_objs[i].base_image,
      trial_objs[i].perturbed_image,
      trial_objs[i].novel_word
    );
    obj.data = {
      stimulus_id: trial_objs[i].stimulus_id,
      category: trial_objs[i].category,
      edit_type: trial_objs[i].edit_type,
      level: trial_objs[i].level,
      novel_word: trial_objs[i].novel_word,
      base_image: trial_objs[i].base_image,
      perturbed_image: trial_objs[i].perturbed_image,
    };
    tv_array.push(obj);
  }
  return tv_array;
}

function shuffle_array(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function get_all_image_paths(trial_objs) {
  let paths = new Set();
  for (let i = 0; i < trial_objs.length; i++) {
    paths.add(trial_objs[i].base_image);
    paths.add(trial_objs[i].perturbed_image);
  }
  return Array.from(paths);
}

function build_trial_html(base_image, perturbed_image, novel_word) {
  return `
    <div class="trial-container">
      <div class="trial-image-pair">
        <div class="trial-image-box">
          <div class="image-label">Original</div>
          <div class="trial-image-frame">
            <img src="${base_image}" alt="Original object" />
          </div>
          <div class="trial-caption">
            Let's call the object in this image "<span class="novel-word">${novel_word}</span>."
          </div>
        </div>
        <div class="trial-image-box">
          <div class="image-label">Variation</div>
          <div class="trial-image-frame">
            <img src="${perturbed_image}" alt="Variation of object" />
          </div>
          <div class="trial-caption">
            Is the object in this image also "<span class="novel-word">${novel_word}</span>"?
          </div>
        </div>
      </div>
      <div class="trial-question">
        The object on the right can also be called "<span class="novel-word">${novel_word}</span>."
      </div>
    </div>
  `;
}

function get_prolific_params() {
  const params = new URLSearchParams(window.location.search);
  return {
    prolific_pid: params.get("PROLIFIC_PID") || params.get("prolific_pid") || "",
    study_id: params.get("STUDY_ID") || params.get("study_id") || "",
    session_id: params.get("SESSION_ID") || params.get("session_id") || "",
  };
}

function download_json(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
