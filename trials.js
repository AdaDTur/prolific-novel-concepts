/**
 * Trial definitions for the Visual Concept Study.
 *
 * Loads trial data from manifest.csv and participant_assignments.json,
 * then builds the trial_objects array for the assigned participant group.
 * Images are served from GitHub Pages (CONFIG.IMAGE_BASE_URL).
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
 * Resolve a relative image path from the manifest to a full URL.
 * Prepends CONFIG.IMAGE_BASE_URL to the path.
 */
function resolveImageURL(relativePath) {
  if (!relativePath) return "";
  // If already a full URL, return as-is
  if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
    return relativePath;
  }
  return CONFIG.IMAGE_BASE_URL + "/" + relativePath;
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
      base_image: resolveImageURL(row.base_image),
      perturbed_image: resolveImageURL(row.perturbed_image),
      novel_word: row.novel_word,
    };
  });

  return { trial_objects: trialObjects, group_index: groupIndex };
}
