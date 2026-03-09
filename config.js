/**
 * Study Configuration
 *
 * Update PROLIFIC_COMPLETION_URL with your Prolific completion code before deployment.
 * Set RESULTS_ENDPOINT to your server URL if using the Flask backend,
 * or leave as null to download results as JSON files.
 */

const CONFIG = {
  // Prolific completion redirect URL — replace YOUR_COMPLETION_CODE
  PROLIFIC_COMPLETION_URL: "https://app.prolific.com/submissions/complete?cc=YOUR_COMPLETION_CODE",

  // Backend endpoint for saving results (null = local JSON download)
  RESULTS_ENDPOINT: null,

  // Whether to randomize trial order
  RANDOMIZE_TRIALS: true,

  // Attention check: which trial index to insert it after (0-indexed)
  ATTENTION_CHECK_AFTER: 10,

  // HuggingFace dataset for image retrieval
  HF_DATASET: "adadtur/nvrd",
  HF_API_BASE: "https://datasets-server.huggingface.co",
};
