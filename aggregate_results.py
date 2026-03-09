"""
Aggregate individual JSON result files into a single CSV for analysis.

Usage:
    python aggregate_results.py [results_dir] [output_file]

Defaults:
    results_dir = ./results/
    output_file = ./results_aggregated.csv
"""

import os
import sys
import json
import csv
from pathlib import Path


def aggregate(results_dir="results", output_file="results_aggregated.csv"):
    results_dir = Path(results_dir)
    if not results_dir.exists():
        print(f"Error: {results_dir} does not exist.")
        return

    json_files = sorted(results_dir.glob("*.json"))
    if not json_files:
        print(f"No JSON files found in {results_dir}.")
        return

    rows = []
    for fp in json_files:
        with open(fp) as f:
            data = json.load(f)

        participant_info = {
            "prolific_pid": data.get("prolific_pid", ""),
            "study_id": data.get("study_id", ""),
            "session_id": data.get("session_id", ""),
            "study_start_time": data.get("study_start_time", ""),
            "study_end_time": data.get("study_end_time", ""),
            "total_duration_ms": data.get("total_duration_ms", ""),
            "attention_check_passed": data.get("attention_check_passed", ""),
        }

        demographics = data.get("demographics", {})
        demo_info = {
            "age": demographics.get("age", ""),
            "gender": demographics.get("gender", ""),
            "native_language": demographics.get("native_language", ""),
            "education": demographics.get("education", ""),
            "feedback": demographics.get("feedback", ""),
        }

        for trial in data.get("trials", []):
            row = {**participant_info, **demo_info, **trial}
            rows.append(row)

    if not rows:
        print("No trial data found.")
        return

    # Write CSV
    fieldnames = list(rows[0].keys())
    with open(output_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Aggregated {len(json_files)} files, {len(rows)} trial rows → {output_file}")


if __name__ == "__main__":
    rdir = sys.argv[1] if len(sys.argv) > 1 else "results"
    ofile = sys.argv[2] if len(sys.argv) > 2 else "results_aggregated.csv"
    aggregate(rdir, ofile)
