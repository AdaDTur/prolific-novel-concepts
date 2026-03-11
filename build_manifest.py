"""
Build a principled manifest.csv and participant_assignments.json for the
Visual Concept pilot study by filtering from the existing full manifest.

Design philosophy (from team feedback):
  - Focus on "high-level" edit types over "low-level" ones
  - Don't need all 20 levels — pick well-spaced levels (humans won't
    distinguish every single step)
  - Cover more visual concepts rather than many levels of the same concept
  - Build the sample with explicit choices, not a random grab bag

Usage:
  python build_manifest.py                     # preview only (dry run)
  python build_manifest.py --write             # overwrite manifest.csv + assignments
  python build_manifest.py --full-manifest manifest_full.csv  # use a different source

Edit the DESIGN section below to configure the study.
"""

import csv
import json
import random
import argparse
from collections import defaultdict

# ============================================================
# DESIGN — edit these to configure the study
# ============================================================

# Which perturbation types to INCLUDE.
# High-level (perceptually interesting):
#   color, shape, style, background, add, remove, texture, scale
# Low-level (technical artifacts, less interesting for human judgments):
#   jpeg, blur, noise, pixelate
INCLUDE_EDIT_TYPES = ["color", "shape", "style", "background", "add", "remove"]

# Which perturbation levels to keep.
# Instead of all 20, pick well-spaced levels so humans see meaningful jumps.
# Set to None to keep all available levels.
INCLUDE_LEVELS = [2, 5, 8, 12, 16, 20]

# How many objects to sample per category (None = keep all).
# More objects = broader coverage; fewer = cheaper.
OBJECTS_PER_CATEGORY = {
    "known": 15,
    "novel": 15,
    "modified/shape-texture": 10,
    "modified/shape-shape/animal-obj": 8,
    "modified/shape-shape/obj-obj": 8,
}

# Participant groups
NUM_GROUPS = 3  # Temporarily reduced for pilot sanity check (expand to 8+ later)
TRIALS_PER_GROUP = 40

# Minimum number of participants that must see each trial (for agreement metrics)
MIN_REPLICATION = 2

# Novel words to cycle through
NOVEL_WORDS = ["dax", "blicket", "wug", "fep", "zup", "toma", "moop", "kiki", "bouba", "noba"]

# Random seed for reproducibility
SEED = 42

# ============================================================
# END DESIGN
# ============================================================


def load_full_manifest(path):
    """Load the full manifest CSV."""
    rows = []
    with open(path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            row["level"] = int(row["level"])
            rows.append(row)
    return rows


def filter_trials(rows):
    """Apply the design filters: edit types, levels, and object sampling."""
    rng = random.Random(SEED)

    # Step 1: Filter by edit type
    filtered = [r for r in rows if r["perturbation_type"] in INCLUDE_EDIT_TYPES]
    print(f"  After edit-type filter: {len(filtered)} trials (from {len(rows)})")

    # Step 2: Filter by level (find closest available level for each target)
    if INCLUDE_LEVELS is not None:
        level_set = set(INCLUDE_LEVELS)
        filtered = [r for r in filtered if r["level"] in level_set]
        print(f"  After level filter: {len(filtered)} trials")

    # Step 3: Sample objects per category
    by_category = defaultdict(list)
    for r in filtered:
        by_category[r["category"]].append(r)

    sampled = []
    objects_selected = {}
    for cat, limit in OBJECTS_PER_CATEGORY.items():
        cat_rows = by_category.get(cat, [])
        # Get unique objects in this category
        all_objects = sorted(set(r["object"] for r in cat_rows))

        if limit is not None and limit < len(all_objects):
            # Prioritize objects that have more trials (better coverage)
            obj_counts = defaultdict(int)
            for r in cat_rows:
                obj_counts[r["object"]] += 1
            # Sort by trial count descending, then sample from top
            ranked = sorted(all_objects, key=lambda o: -obj_counts[o])
            selected = sorted(rng.sample(ranked[:limit + 5] if limit + 5 <= len(ranked) else ranked, min(limit, len(ranked))))
        else:
            selected = all_objects

        objects_selected[cat] = selected
        for r in cat_rows:
            if r["object"] in set(selected):
                sampled.append(r)

        print(f"  {cat}: {len(selected)} objects (from {len(all_objects)}), {sum(1 for r in cat_rows if r['object'] in set(selected))} trials")

    # Include any categories not in OBJECTS_PER_CATEGORY (keep all)
    for cat in by_category:
        if cat not in OBJECTS_PER_CATEGORY:
            for r in by_category[cat]:
                sampled.append(r)
            objects_selected[cat] = sorted(set(r["object"] for r in by_category[cat]))
            print(f"  {cat}: {len(objects_selected[cat])} objects (all kept)")

    return sampled, objects_selected


def assign_novel_words(trials, rng):
    """Assign novel words, cycling through the list."""
    words = NOVEL_WORDS[:]
    rng.shuffle(words)
    for i, trial in enumerate(trials):
        trial["novel_word"] = words[i % len(words)]


def make_group_assignments(num_trials, num_groups, trials_per_group, rng, min_replication=2):
    """
    Assign trial indices to groups, ensuring each trial is seen by at least
    min_replication participants (for inter-rater agreement).
    """
    if num_trials <= trials_per_group:
        # Every group sees all trials
        return [list(range(num_trials)) for _ in range(num_groups)]

    total_slots = num_groups * trials_per_group
    if total_slots < num_trials * min_replication:
        print(f"  WARNING: {total_slots} slots < {num_trials} trials × {min_replication} = "
              f"{num_trials * min_replication}. Cannot guarantee {min_replication}x replication.")

    # Build a pool where each trial appears min_replication times, then fill remaining slots
    pool = list(range(num_trials)) * min_replication
    remaining_slots = total_slots - len(pool)
    if remaining_slots > 0:
        pool += rng.choices(range(num_trials), k=remaining_slots)
    rng.shuffle(pool)

    # Deal into groups
    groups = [[] for _ in range(num_groups)]
    for i, idx in enumerate(pool):
        g = i % num_groups
        groups[g].append(idx)

    # Trim any excess (shouldn't happen, but safety)
    for g in groups:
        while len(g) > trials_per_group:
            g.pop()

    for g in groups:
        g.sort()

    return groups


def print_summary(trials, objects_selected, groups):
    """Print a summary table of the design."""
    print("\n" + "=" * 60)
    print("DESIGN SUMMARY")
    print("=" * 60)

    print(f"\n  Edit types ({len(INCLUDE_EDIT_TYPES)}): {', '.join(INCLUDE_EDIT_TYPES)}")
    if INCLUDE_LEVELS:
        print(f"  Levels ({len(INCLUDE_LEVELS)}): {INCLUDE_LEVELS}")
    else:
        print(f"  Levels: all available")

    print(f"\n  Category breakdown:")
    total_objects = 0
    for cat in sorted(objects_selected):
        n_obj = len(objects_selected[cat])
        n_trials = sum(1 for t in trials if t["category"] == cat)
        total_objects += n_obj
        print(f"    {cat}: {n_obj} objects, {n_trials} trials")

    print(f"\n  Total: {total_objects} objects, {len(trials)} trials")
    print(f"  Groups: {NUM_GROUPS} x {TRIALS_PER_GROUP} trials/participant")

    # Compute per-trial replication counts
    trial_counts = defaultdict(int)
    for g in groups:
        for idx in g:
            trial_counts[idx] += 1
    unique_covered = len(trial_counts)
    min_rep = min(trial_counts.values()) if trial_counts else 0
    max_rep = max(trial_counts.values()) if trial_counts else 0
    avg_rep = sum(trial_counts.values()) / len(trial_counts) if trial_counts else 0
    print(f"  Trial coverage: {unique_covered}/{len(trials)} unique trials seen")
    print(f"  Replications per trial: min={min_rep}, avg={avg_rep:.1f}, max={max_rep}")
    print(f"  Min replication target: {MIN_REPLICATION}")

    # Edit type x level distribution
    dist = defaultdict(int)
    for t in trials:
        dist[(t["perturbation_type"], t["level"])] += 1
    print(f"\n  Edit type x Level distribution:")
    levels = sorted(set(t["level"] for t in trials))
    header = f"    {'':>12}" + "".join(f"  L{l:<3}" for l in levels) + "  Total"
    print(header)
    for et in sorted(INCLUDE_EDIT_TYPES):
        row_vals = [dist.get((et, l), 0) for l in levels]
        row = f"    {et:>12}" + "".join(f"  {v:<4}" for v in row_vals) + f"  {sum(row_vals)}"
        print(row)


def main():
    parser = argparse.ArgumentParser(description="Build study manifest by filtering existing data")
    parser.add_argument("--full-manifest", default="manifest.csv",
                        help="Path to the full manifest to filter from")
    parser.add_argument("--output-dir", default=".", help="Output directory")
    parser.add_argument("--write", action="store_true",
                        help="Actually write files (default: preview only)")
    args = parser.parse_args()

    rng = random.Random(SEED)

    print("Loading full manifest...")
    rows = load_full_manifest(args.full_manifest)
    print(f"  {len(rows)} total trials\n")

    print("Applying design filters...")
    trials, objects_selected = filter_trials(rows)

    # Re-index and assign novel words
    rng2 = random.Random(SEED)
    assign_novel_words(trials, rng2)
    for i, trial in enumerate(trials):
        trial["trial_id"] = i

    # Make group assignments
    groups = make_group_assignments(len(trials), NUM_GROUPS, TRIALS_PER_GROUP, rng, MIN_REPLICATION)

    print_summary(trials, objects_selected, groups)

    if not args.write:
        print("\n  [PREVIEW] No files written. Use --write to save.")
        return

    # Back up existing files
    import shutil
    from pathlib import Path
    out_dir = Path(args.output_dir)

    manifest_path = out_dir / "manifest.csv"
    assignments_path = out_dir / "participant_assignments.json"

    if manifest_path.exists():
        backup = out_dir / "manifest_full_backup.csv"
        if not backup.exists():
            shutil.copy2(manifest_path, backup)
            print(f"\n  Backed up original manifest to {backup}")

    # Write new manifest
    fieldnames = ["trial_id", "category", "object", "perturbation_type", "level",
                  "base_image", "perturbed_image", "novel_word"]
    with open(manifest_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for trial in trials:
            writer.writerow({k: trial[k] for k in fieldnames})
    print(f"  Wrote {manifest_path} ({len(trials)} trials)")

    # Write assignments
    with open(assignments_path, "w") as f:
        json.dump(groups, f, indent=2)
    print(f"  Wrote {assignments_path} ({NUM_GROUPS} groups)")


if __name__ == "__main__":
    main()
