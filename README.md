# Novel Concept Learning — Prolific Study

Human evaluation study for the Novel Visual References Dataset (NVRD). Participants are shown pairs of images (original + perturbed) and asked whether the object in the perturbed image can be called by the same novel reference word as the original.

## Study Design

| Element | Details |
|---------|---------|
| **Trial structure** | Side-by-side image pair (L0 base + L1–L5 perturbation) |
| **Prompt** | "Let's call the object in this image *'dax'*." → "Is the object in this image also *'dax'*?" |
| **Response** | 5-point Likert: Strongly Disagree → Strongly Agree |
| **Optional** | Free-text explanation |
| **Trials per participant** | 25 (5 categories × 1 item × 5 perturbation levels) |
| **Categories** | Known, Modified (shape-texture), Modified (shape-shape: animal-obj), Modified (shape-shape: obj-obj), Novel |
| **Attention check** | After trial 13 — "What was the made-up name used in the last trial?" |
| **Demographics** | Age, gender, native language, education (all optional) |

## Project Structure

```
prolific-novel-concepts/
├── index.html              # Main study application (single page)
├── config.js               # Study config + stimulus definitions
├── server.py               # Optional Flask backend for result collection
├── aggregate_results.py    # Script to combine JSON results into CSV
├── images/                 # Place NVRD images here (see below)
│   ├── known/
│   ├── modified-shape-texture/
│   ├── modified-shape-shape-animal-obj/
│   ├── modified-shape-shape-obj-obj/
│   └── novel/
└── results/                # Collected result JSON files
```

## Setup

### 1. Add Your Images

Place your NVRD images in the `images/` directory following the naming convention in `config.js`. The expected structure is:

```
images/
├── known/
│   ├── known_001_L0.png    # Base image
│   ├── known_001_L1.png    # Perturbation level 1
│   ├── known_001_L2.png    # Perturbation level 2
│   ├── ...
│   └── known_001_L5.png    # Perturbation level 5
├── novel/
│   ├── novel_001_L0.png
│   └── ...
└── ...
```

### 2. Update `config.js`

1. **`IMAGE_BASE_URL`**: Set to where images are hosted. If deploying to GitHub Pages, use `"images/"` (relative). If using an external CDN or S3 bucket, use the full URL.

2. **`PROLIFIC_COMPLETION_URL`**: Replace `YOUR_COMPLETION_CODE` with the actual code from Prolific.

3. **`STIMULI` array**: Update with your actual NVRD items — image filenames, novel reference words, and categories. You need at least `N_ITEMS_PER_CATEGORY` (default: 1) items per category.

4. **`N_ITEMS_PER_CATEGORY`**: Increase if you want more items sampled per category (e.g., set to 2 for 50 trials).

### 3. Deploy

**Option A: GitHub Pages (static, no backend)**

```bash
git init
git add .
git commit -m "Initial study setup"
git remote add origin git@github.com:YourOrg/novel-concept-study.git
git push -u origin main
```

Enable GitHub Pages in repo settings → results are downloaded as JSON files by each participant.

**Option B: Self-hosted with Flask backend**

```bash
pip install flask flask-cors
python server.py
```

Update `config.js`:
```js
RESULTS_ENDPOINT: "http://your-server:5000/api/submit",
```

Results are saved to `./results/` as individual JSON files.

### 4. Configure on Prolific

1. Set study URL to:
   ```
   https://your-domain.github.io/novel-concept-study/?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}
   ```

2. Under "How to confirm participants have completed your study" → select **"I'll redirect them using a URL"**

3. Copy the completion code from Prolific and paste it into `config.js` (`PROLIFIC_COMPLETION_URL`)

## Data Analysis

After collecting results, aggregate into a CSV:

```bash
python aggregate_results.py results/ results_aggregated.csv
```

Output columns include: `prolific_pid`, `stimulus_id`, `category`, `novel_word`, `perturbation_level`, `rating` (1–5), `explanation`, `response_time_ms`, `attention_check_passed`, demographics fields.

## Customization

- **More trials**: Increase `N_ITEMS_PER_CATEGORY` in `config.js` and add more stimuli entries
- **Different Likert labels**: Edit the `LIKERT_OPTIONS` array in `index.html`
- **Attention check timing**: Change the `currentTrialIndex === 13` check in `nextTrial()`
- **Additional attention checks**: Add more checkpoints following the same pattern
- **Styling**: All CSS is in `index.html` under `:root` variables

## Requirements

- Modern web browser (Chrome, Firefox, Safari, Edge)
- No server required for GitHub Pages deployment
- Python 3.7+ for Flask backend and aggregation script
