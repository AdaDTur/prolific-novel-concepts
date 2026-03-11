import csv
import json
import random
import argparse
from collections import defaultdict

INCLUDE_EDIT_TYPES = ["color", "shape", "style", "background", "add", "remove"]
INCLUDE_LEVELS = [2, 5, 8, 11, 14, 18, 19]
OBJECTS_PER_CATEGORY = {
    "known": 15,
    "novel": 15,
    "modified/shape-texture": 10,
    "modified/shape-shape/animal-obj": 8,
    "modified/shape-shape/obj-obj": 8,
}

NUM_GROUPS = 10
TRIALS_PER_GROUP = 80
MIN_REPLICATION = 2
NONCE_WORDS_FILE = open("/Users/adatur/Mila/learning biases/learning-biases/nonce_words.txt", "r")
NOVEL_WORDS = list(NONCE_WORDS_FILE.readlines())
SEED = 42

def load_full_manifest(path):
    rows = []
    with open(path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            row["level"] = int(row["level"])
            rows.append(row)
    return rows


def filter_trials(rows):
    rng = random.Random(SEED)
    filtered = [r for r in rows if r["perturbation_type"] in INCLUDE_EDIT_TYPES]
    print(f"  After edit-type filter: {len(filtered)} trials (from {len(rows)})")

    if INCLUDE_LEVELS is not None:
        level_set = set(INCLUDE_LEVELS)
        filtered = [r for r in filtered if r["level"] in level_set]
        print(f"  After level filter: {len(filtered)} trials")

    by_category = defaultdict(list)
    for r in filtered:
        by_category[r["category"]].append(r)

    sampled = []
    objects_selected = {}
    for cat, limit in OBJECTS_PER_CATEGORY.items():
        cat_rows = by_category.get(cat, [])
        all_objects = sorted(set(r["object"] for r in cat_rows))

        if limit is not None and limit < len(all_objects):
            obj_counts = defaultdict(int)
            for r in cat_rows:
                obj_counts[r["object"]] += 1
            ranked = sorted(all_objects, key=lambda o: -obj_counts[o])
            selected = sorted(rng.sample(ranked[:limit + 5] if limit + 5 <= len(ranked) else ranked, min(limit, len(ranked))))
        else:
            selected = all_objects

        objects_selected[cat] = selected
        for r in cat_rows:
            if r["object"] in set(selected):
                sampled.append(r)

        print(f"  {cat}: {len(selected)} objects (from {len(all_objects)}), {sum(1 for r in cat_rows if r['object'] in set(selected))} trials")

    for cat in by_category:
        if cat not in OBJECTS_PER_CATEGORY:
            for r in by_category[cat]:
                sampled.append(r)
            objects_selected[cat] = sorted(set(r["object"] for r in by_category[cat]))
            print(f"  {cat}: {len(objects_selected[cat])} objects (all kept)")

    if INCLUDE_LEVELS is not None:
        by_level = defaultdict(list)
        for r in sampled:
            by_level[r["level"]].append(r)
        min_count = min(len(v) for v in by_level.values())
        print(f"  Balancing levels: capping each level to {min_count} trials (min available)")
        balanced = []
        for lvl in sorted(by_level.keys(), key=int):
            trials_at_lvl = by_level[lvl]
            if len(trials_at_lvl) > min_count:
                rng.shuffle(trials_at_lvl)
                trials_at_lvl = trials_at_lvl[:min_count]
            balanced.extend(trials_at_lvl)
        sampled = balanced
        objects_selected = {}
        for r in sampled:
            cat = r["category"]
            if cat not in objects_selected:
                objects_selected[cat] = set()
            objects_selected[cat].add(r["object"])
        objects_selected = {cat: sorted(objs) for cat, objs in objects_selected.items()}
        print(f"  After balancing: {len(sampled)} trials")

    return sampled, objects_selected


def assign_novel_words(trials, rng):
    words = NOVEL_WORDS[:]
    rng.shuffle(words)
    for i, trial in enumerate(trials):
        trial["novel_word"] = words[i % len(words)]


def make_group_assignments(num_trials, num_groups, trials_per_group, rng, min_replication=2):
    if num_trials <= trials_per_group:
        return [list(range(num_trials)) for _ in range(num_groups)]

    total_slots = num_groups * trials_per_group
    if total_slots < num_trials * min_replication:
        print(f"  WARNING: {total_slots} slots < {num_trials} trials × {min_replication} = "
              f"{num_trials * min_replication}. Cannot guarantee {min_replication}x replication.")

    pool = list(range(num_trials)) * min_replication
    remaining_slots = total_slots - len(pool)
    if remaining_slots > 0:
        pool += rng.choices(range(num_trials), k=remaining_slots)
    rng.shuffle(pool)

    groups = [[] for _ in range(num_groups)]
    for i, idx in enumerate(pool):
        g = i % num_groups
        groups[g].append(idx)

    for g in groups:
        while len(g) > trials_per_group:
            g.pop()

    for g in groups:
        g.sort()

    return groups


def print_summary(trials, objects_selected, groups):
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
    full_manifest = "manifest.csv"
    output_dir = "."
    write = True
    rng = random.Random(SEED)

    print("Loading full manifest...")
    rows = load_full_manifest(full_manifest)
    print(f"  {len(rows)} total trials\n")

    print("Applying design filters...")
    trials, objects_selected = filter_trials(rows)

    rng2 = random.Random(SEED)
    assign_novel_words(trials, rng2)
    for i, trial in enumerate(trials):
        trial["trial_id"] = i

    groups = make_group_assignments(len(trials), NUM_GROUPS, TRIALS_PER_GROUP, rng, MIN_REPLICATION)

    print_summary(trials, objects_selected, groups)

    if not write:
        print("\n  [PREVIEW] No files written. Use --write to save.")
        return

    import shutil
    from pathlib import Path
    out_dir = Path(output_dir)

    manifest_path = out_dir / "manifest.csv"
    assignments_path = out_dir / "participant_assignments.json"

    if manifest_path.exists():
        backup = out_dir / "manifest_full_backup.csv"
        if not backup.exists():
            shutil.copy2(manifest_path, backup)
            print(f"\n  Backed up original manifest to {backup}")

    fieldnames = ["trial_id", "category", "object", "perturbation_type", "level",
                  "base_image", "perturbed_image", "novel_word"]
    with open(manifest_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for trial in trials:
            writer.writerow({k: trial[k] for k in fieldnames})
    print(f"  Wrote {manifest_path} ({len(trials)} trials)")

    with open(assignments_path, "w") as f:
        json.dump(groups, f, indent=2)
    print(f"  Wrote {assignments_path} ({NUM_GROUPS} groups)")


if __name__ == "__main__":
    main()
