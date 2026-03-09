/**
 * Trial definitions for the Visual Concept Study.
 *
 * Loads trial data from manifest.csv and participant_assignments.json,
 * then builds the trial_objects array for the assigned participant group.
 * Images are retrieved from the HuggingFace dataset (CONFIG.HF_DATASET).
 */

/**
 * Parse a CSV string into an array of objects (using the header row as keys).
 */
function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j].trim()] = values[j] ? values[j].trim() : "";
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Determine the participant group index.
 * Checks for a GROUP URL parameter first; otherwise assigns randomly.
 */
function getParticipantGroup(numGroups) {
  const params = new URLSearchParams(window.location.search);
  const groupParam = params.get("GROUP") || params.get("group");
  if (groupParam !== null) {
    const g = parseInt(groupParam, 10);
    if (!isNaN(g) && g >= 0 && g < numGroups) {
      return g;
    }
  }
  // Random assignment as fallback
  return Math.floor(Math.random() * numGroups);
}

/**
 * Build a lookup key for HF image resolution.
 */
function hfKey(split, object, perturbationType, level) {
  return `${split}|${object}|${perturbationType}|${level}`;
}

/**
 * Fetch image URLs from the HuggingFace Datasets Server API.
 * Groups requests by split and fetches all rows for needed objects.
 *
 * @param {Map} specsByKey - Map of hfKey -> { split, object }
 * @returns {Map} hfKey -> { image_url, original_image_url }
 */
async function fetchHFImageURLs(specsByKey) {
  const apiBase = CONFIG.HF_API_BASE;
  const dataset = CONFIG.HF_DATASET;
  const urlMap = new Map();

  // Group by split -> set of objects
  const bySplit = {};
  for (const [, spec] of specsByKey) {
    if (!bySplit[spec.split]) bySplit[spec.split] = new Set();
    bySplit[spec.split].add(spec.object);
  }

  for (const [split, objectSet] of Object.entries(bySplit)) {
    const objects = Array.from(objectSet);
    // Escape single quotes in object names for SQL
    const objectList = objects.map((o) => "'" + o.replace(/'/g, "''") + "'").join(",");
    const where = "split='" + split + "' AND object IN (" + objectList + ")";

    let offset = 0;
    const pageSize = 100;

    while (true) {
      const url =
        apiBase +
        "/filter?dataset=" + encodeURIComponent(dataset) +
        "&config=default&split=train" +
        "&where=" + encodeURIComponent(where) +
        "&offset=" + offset +
        "&length=" + pageSize;

      const resp = await fetch(url);
      if (!resp.ok) {
        console.error("HF API error:", resp.status, await resp.text());
        break;
      }
      const data = await resp.json();
      if (!data.rows || data.rows.length === 0) break;

      for (const entry of data.rows) {
        const row = entry.row;
        const rowKey = hfKey(row.split, row.object, row.perturbation_type, row.level);
        if (specsByKey.has(rowKey)) {
          urlMap.set(rowKey, {
            image_url: (row.image && row.image.src) || "",
            original_image_url: (row.original_image && row.original_image.src) || "",
          });
        }
      }

      offset += data.rows.length;
      if (data.rows.length < pageSize) break;
    }
  }

  return urlMap;
}

/**
 * Resolve image URLs from the HuggingFace dataset for trial objects
 * and any extra images (practice / attention check).
 *
 * Mutates trial objects in place (sets base_image and perturbed_image to HF URLs).
 *
 * @param {Array} trialObjects - trial objects from loadTrialData
 * @param {Array} extraImageSpecs - array of { id, split, object, perturbation_type, level }
 * @returns {Object} mapping of extra image id -> resolved HF URL
 */
async function resolveHFImages(trialObjects, extraImageSpecs) {
  const specsByKey = new Map();

  // Trial images
  for (const trial of trialObjects) {
    // Perturbed image row
    const pertKey = hfKey(trial.category, trial.stimulus_id, trial.edit_type, trial.level);
    specsByKey.set(pertKey, { split: trial.category, object: trial.stimulus_id });

    // Base (original) image row
    const baseKey = hfKey(trial.category, trial.stimulus_id, "original", 0);
    specsByKey.set(baseKey, { split: trial.category, object: trial.stimulus_id });
  }

  // Extra images (practice, attention check)
  for (const spec of extraImageSpecs) {
    const key = hfKey(spec.split, spec.object, spec.perturbation_type, spec.level);
    specsByKey.set(key, { split: spec.split, object: spec.object });
  }

  console.log("Fetching " + specsByKey.size + " images from HuggingFace...");
  const urlMap = await fetchHFImageURLs(specsByKey);
  console.log("Resolved " + urlMap.size + " image URLs from HuggingFace.");

  // Apply resolved URLs to trial objects
  for (const trial of trialObjects) {
    const pertKey = hfKey(trial.category, trial.stimulus_id, trial.edit_type, trial.level);
    const baseKey = hfKey(trial.category, trial.stimulus_id, "original", 0);

    const pertURLs = urlMap.get(pertKey);
    const baseURLs = urlMap.get(baseKey);

    if (pertURLs) {
      trial.perturbed_image = pertURLs.image_url;
    }
    if (baseURLs) {
      trial.base_image = baseURLs.image_url;
    }
  }

  // Build resolved extra image URLs
  const resolvedExtra = {};
  for (const spec of extraImageSpecs) {
    const key = hfKey(spec.split, spec.object, spec.perturbation_type, spec.level);
    const urls = urlMap.get(key);
    resolvedExtra[spec.id] = urls ? urls.image_url : "";
  }

  return resolvedExtra;
}

/**
 * Load manifest.csv and participant_assignments.json, then build trial_objects.
 * Returns a Promise that resolves to the trial_objects array.
 */
async function loadTrialData() {
  const [manifestText, assignmentsResponse] = await Promise.all([
    fetch("manifest.csv").then((r) => r.text()),
    fetch("participant_assignments.json").then((r) => r.json()),
  ]);

  const manifest = parseCSV(manifestText);
  const assignments = assignmentsResponse;
  const groupIndex = getParticipantGroup(assignments.length);
  const trialIndices = assignments[groupIndex];

  console.log(
    `Participant group: ${groupIndex}, trials: ${trialIndices.length}`
  );

  const trialObjects = trialIndices.map(function (idx) {
    const row = manifest[idx];
    return {
      stimulus_id: row.object,
      category: row.category,
      edit_type: row.perturbation_type,
      level: parseInt(row.level, 10),
      base_image: row.base_image,
      perturbed_image: row.perturbed_image,
      novel_word: row.novel_word,
    };
  });

  return { trial_objects: trialObjects, group_index: groupIndex };
}
