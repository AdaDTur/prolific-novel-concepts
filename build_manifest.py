"""
Build a study manifest of 800 unique image-pair trials, distributed across
5 categories, 7 perturbation types, and 7 levels.

Each object is assigned specific (pert_type, level) pairs systematically so
that across the full design, all pert types and levels are evenly represented.

- 10 participant groups × 80 trials each, NO overlap between groups
- Each group shown to 2 participants (20 participants total)
- Image paths reference the GitHub Pages host (adadtur.github.io/nvrd-sample)

Run:  python build_manifest.py
"""

import csv
import json
import random
import subprocess
from collections import defaultdict
from pathlib import Path
from itertools import product

# ---------------------------------------------------------------------------
# Design parameters
# ---------------------------------------------------------------------------
INCLUDE_EDIT_TYPES = ["color", "shape", "style", "background", "add", "remove", "texture"]
INCLUDE_LEVELS = [2, 5, 8, 11, 14, 18, 19]

NUM_GROUPS = 10
TRIALS_PER_GROUP = 80
TOTAL_TRIALS = NUM_GROUPS * TRIALS_PER_GROUP  # 800

NONCE_WORDS_PATH = Path(__file__).resolve().parent.parent / "nonce_words.txt"
NOVEL_WORDS = [w.strip() for w in open(NONCE_WORDS_PATH) if w.strip()]

SEED = 42

# Category name -> directory prefix used in GitHub Pages image URLs
CATEGORIES = {
    "known":                          "known",
    "novel":                          "novel",
    "modified/shape-texture":         "modified-shape-texture",
    "modified/shape-shape/animal-obj": "modified-animal-obj",
    "modified/shape-shape/obj-obj":   "modified-obj-obj",
}

CATEGORY_ORDER = list(CATEGORIES.keys())

# Relative weights (= number of available objects per category)
CATEGORY_WEIGHTS = {
    "known": 49,
    "novel": 50,
    "modified/shape-texture": 50,
    "modified/shape-shape/animal-obj": 25,
    "modified/shape-shape/obj-obj": 25,
}

GH_REPO = "AdaDTur/nvrd-sample"


# ---------------------------------------------------------------------------
# Fetch available objects from the GitHub repo
# ---------------------------------------------------------------------------
def fetch_objects_from_repo():
    """Use `gh` CLI to list base images per category from the GitHub repo."""
    objects_by_cat = {}
    for cat, dir_prefix in CATEGORIES.items():
        result = subprocess.run(
            ["gh", "api", f"repos/{GH_REPO}/contents/{dir_prefix}",
             "--jq", '[.[] | select(.name | endswith(".png")) | .name]'],
            capture_output=True, text=True
        )
        names = json.loads(result.stdout) if result.stdout.strip() else []
        objects_by_cat[cat] = sorted(n.replace(".png", "") for n in names)
        print(f"  {cat}: {len(objects_by_cat[cat])} objects")
    return objects_by_cat


# ---------------------------------------------------------------------------
# Systematically assign (pert_type, level) combos to objects
# ---------------------------------------------------------------------------
def generate_trials(objects_by_cat, rng):
    """
    For each category, cycle through the 42 possible (pert_type, level) combos
    and assign them round-robin to objects. This ensures:
    - Each object gets a distinct set of (pert_type, level) pairs
    - All 6 pert types and 7 levels are evenly covered
    - No two trials share the same (category, object, pert_type, level)
    """
    n_types = len(INCLUDE_EDIT_TYPES)
    n_levels = len(INCLUDE_LEVELS)
    n_cells = n_types * n_levels  # 42

    # Compute per-category trial counts (proportional to weight, sum to 800)
    total_weight = sum(CATEGORY_WEIGHTS.values())
    cat_targets = {}
    allocated = 0
    cats = list(CATEGORY_ORDER)
    for i, cat in enumerate(cats):
        if i == len(cats) - 1:
            cat_targets[cat] = TOTAL_TRIALS - allocated
        else:
            cat_targets[cat] = round(TOTAL_TRIALS * CATEGORY_WEIGHTS[cat] / total_weight)
            allocated += cat_targets[cat]

    print(f"\n  Per-category targets (sum={sum(cat_targets.values())}):")
    for cat in CATEGORY_ORDER:
        n_obj = len(objects_by_cat[cat])
        trials_per_obj = cat_targets[cat] / n_obj
        print(f"    {cat}: {cat_targets[cat]} trials across {n_obj} objects "
              f"(~{trials_per_obj:.1f} trials/object)")

    # Each object gets exactly `trials_per_obj` trials, each with a DISTINCT
    # perturbation type and a DISTINCT level. We cycle through types and levels
    # across objects so the overall distribution stays balanced.
    #
    # With ~4 trials/object and 6 types × 7 levels, this is easy to satisfy.

    n_types = len(INCLUDE_EDIT_TYPES)
    n_levels = len(INCLUDE_LEVELS)

    all_trials = []
    for cat in CATEGORY_ORDER:
        objects = objects_by_cat[cat][:]
        rng.shuffle(objects)
        dir_prefix = CATEGORIES[cat]
        target = cat_targets[cat]
        n_obj = len(objects)

        trials_per_obj_base = target // n_obj
        remainder = target % n_obj

        # Rotating cursors so consecutive objects get different types/levels
        type_cursor = 0
        level_cursor = 0

        # Shuffle the orderings for this category
        types_order = INCLUDE_EDIT_TYPES[:]
        levels_order = INCLUDE_LEVELS[:]
        rng.shuffle(types_order)
        rng.shuffle(levels_order)

        for oi, obj in enumerate(objects):
            n_for_this = trials_per_obj_base + (1 if oi < remainder else 0)

            # Pick n_for_this distinct types and n_for_this distinct levels
            obj_types = []
            for j in range(n_for_this):
                obj_types.append(types_order[(type_cursor + j) % n_types])
            type_cursor += n_for_this

            obj_levels = []
            for j in range(n_for_this):
                obj_levels.append(levels_order[(level_cursor + j) % n_levels])
            level_cursor += n_for_this

            for pt, lev in zip(obj_types, obj_levels):
                all_trials.append({
                    "category": cat,
                    "object": obj,
                    "perturbation_type": pt,
                    "level": lev,
                    "base_image": f"{dir_prefix}/{obj}.png",
                    "perturbed_image": f"{dir_prefix}/{pt}/{obj}_{lev}.png",
                })

    # Verify uniqueness (no duplicate (cat, obj, type, level) combos)
    keys = set()
    for t in all_trials:
        key = (t["category"], t["object"], t["perturbation_type"], t["level"])
        assert key not in keys, f"Duplicate trial: {key}"
        keys.add(key)

    # Verify distinct types per object
    by_obj = defaultdict(list)
    for t in all_trials:
        by_obj[(t["category"], t["object"])].append(t)
    for (cat, obj), obj_trials in by_obj.items():
        types_used = [t["perturbation_type"] for t in obj_trials]
        assert len(types_used) == len(set(types_used)), \
            f"Repeated pert type for {cat}/{obj}: {types_used}"

    assert len(all_trials) == TOTAL_TRIALS, f"Expected {TOTAL_TRIALS}, got {len(all_trials)}"
    return all_trials


# ---------------------------------------------------------------------------
# Assign nonce words (one per unique object)
# ---------------------------------------------------------------------------
def assign_novel_words(trials, rng):
    objects = sorted(set(t["object"] for t in trials))
    words = NOVEL_WORDS[:]
    rng.shuffle(words)
    obj_to_word = {obj: words[i % len(words)] for i, obj in enumerate(objects)}
    for t in trials:
        t["novel_word"] = obj_to_word[t["object"]]


# ---------------------------------------------------------------------------
# Assign trials to 10 non-overlapping groups of 80
# ---------------------------------------------------------------------------
def make_group_assignments(trials, rng):
    """
    Partition 800 trials into 10 groups of 80. No overlap.
    Shuffle before partitioning so each group gets a mix of categories/types/levels.
    """
    indices = list(range(len(trials)))
    rng.shuffle(indices)

    groups = []
    for g in range(NUM_GROUPS):
        start = g * TRIALS_PER_GROUP
        groups.append(sorted(indices[start:start + TRIALS_PER_GROUP]))

    return groups


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
def print_summary(trials, groups):
    print("\n" + "=" * 60)
    print("DESIGN SUMMARY")
    print("=" * 60)

    print(f"\n  Edit types ({len(INCLUDE_EDIT_TYPES)}): {', '.join(INCLUDE_EDIT_TYPES)}")
    print(f"  Levels ({len(INCLUDE_LEVELS)}): {INCLUDE_LEVELS}")

    by_cat = defaultdict(list)
    for t in trials:
        by_cat[t["category"]].append(t)

    print(f"\n  Category breakdown:")
    total_objects = 0
    for cat in CATEGORY_ORDER:
        cat_trials = by_cat.get(cat, [])
        objs = set(t["object"] for t in cat_trials)
        total_objects += len(objs)
        print(f"    {cat}: {len(objs)} objects, {len(cat_trials)} trials")

    print(f"\n  Total: {total_objects} objects, {len(trials)} trials")
    print(f"  Groups: {NUM_GROUPS} x {TRIALS_PER_GROUP} (NO overlap between groups)")

    # Verify non-overlapping
    all_assigned = []
    for g in groups:
        all_assigned.extend(g)
    assert len(all_assigned) == len(set(all_assigned)), "Groups overlap!"
    assert len(all_assigned) == TOTAL_TRIALS
    print(f"  Non-overlapping verified ✓")

    # Per-group category distribution
    print(f"\n  Per-group category distribution:")
    short = {cat: cat.split("/")[-1][:8] for cat in CATEGORY_ORDER}
    header = f"    {'Group':>6}" + "".join(f"  {short[c]:>10}" for c in CATEGORY_ORDER) + "  Total"
    print(header)
    for gi, g in enumerate(groups):
        group_by_cat = defaultdict(int)
        for idx in g:
            group_by_cat[trials[idx]["category"]] += 1
        vals = [group_by_cat.get(cat, 0) for cat in CATEGORY_ORDER]
        row = f"    {gi:>6}" + "".join(f"  {v:>10}" for v in vals) + f"  {sum(vals)}"
        print(row)

    # Per-group pert-type distribution
    print(f"\n  Per-group pert-type distribution:")
    header = f"    {'Group':>6}" + "".join(f"  {pt:>10}" for pt in INCLUDE_EDIT_TYPES) + "  Total"
    print(header)
    for gi, g in enumerate(groups):
        group_by_pt = defaultdict(int)
        for idx in g:
            group_by_pt[trials[idx]["perturbation_type"]] += 1
        vals = [group_by_pt.get(pt, 0) for pt in INCLUDE_EDIT_TYPES]
        row = f"    {gi:>6}" + "".join(f"  {v:>10}" for v in vals) + f"  {sum(vals)}"
        print(row)

    # Overall pert type × level distribution
    dist = defaultdict(int)
    for t in trials:
        dist[(t["perturbation_type"], t["level"])] += 1
    print(f"\n  Overall Edit type x Level distribution:")
    levels = sorted(set(t["level"] for t in trials))
    header = f"    {'':>12}" + "".join(f"  L{l:<3}" for l in levels) + "  Total"
    print(header)
    for et in sorted(INCLUDE_EDIT_TYPES):
        row_vals = [dist.get((et, l), 0) for l in levels]
        row = f"    {et:>12}" + "".join(f"  {v:<4}" for v in row_vals) + f"  {sum(row_vals)}"
        print(row)

    # Show a few example object assignments
    print(f"\n  Example object assignments:")
    shown = set()
    for t in trials:
        obj = t["object"]
        cat = t["category"]
        key = (cat, obj)
        if key not in shown and len(shown) < 8:
            shown.add(key)
            obj_trials = [x for x in trials if x["object"] == obj and x["category"] == cat]
            assignments = [(x["perturbation_type"], x["level"]) for x in obj_trials]
            print(f"    {cat}/{obj}: {assignments}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    rng = random.Random(SEED)
    out_dir = Path(__file__).resolve().parent

    print("Fetching objects from GitHub repo...")
    objects_by_cat = fetch_objects_from_repo()

    print("\nGenerating 800 trials systematically...")
    trials = generate_trials(objects_by_cat, rng)

    rng2 = random.Random(SEED)
    assign_novel_words(trials, rng2)

    for i, trial in enumerate(trials):
        trial["trial_id"] = i

    print("\nAssigning to 10 non-overlapping groups...")
    groups = make_group_assignments(trials, rng)

    print_summary(trials, groups)

    # Write outputs
    manifest_path = out_dir / "manifest.csv"
    assignments_path = out_dir / "participant_assignments.json"

    fieldnames = ["trial_id", "category", "object", "perturbation_type", "level",
                  "base_image", "perturbed_image", "novel_word"]
    with open(manifest_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for trial in trials:
            writer.writerow({k: trial[k] for k in fieldnames})
    print(f"\n  Wrote {manifest_path} ({len(trials)} trials)")

    with open(assignments_path, "w") as f:
        json.dump(groups, f, indent=2)
    print(f"  Wrote {assignments_path} ({NUM_GROUPS} groups)")


if __name__ == "__main__":
    main()
