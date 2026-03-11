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

function getParticipantGroup(numGroups) {
  const params = new URLSearchParams(window.location.search);
  const groupParam = params.get("GROUP") || params.get("group");
  if (groupParam !== null) {
    const g = parseInt(groupParam, 10);
    if (!isNaN(g) && g >= 0 && g < numGroups) {
      return g;
    }
  }
  return Math.floor(Math.random() * numGroups);
}

function resolveImageURL(relativePath) {
  if (!relativePath) return "";
  if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
    return relativePath;
  }
  return CONFIG.IMAGE_BASE_URL + "/" + relativePath;
}

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
