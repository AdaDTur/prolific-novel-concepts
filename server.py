"""
Simple Flask backend for collecting Prolific study results.

Usage:
    pip install flask flask-cors
    python server.py

Results are saved as JSON files in the ./results/ directory.
"""

import os
import json
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

RESULTS_DIR = "results"
os.makedirs(RESULTS_DIR, exist_ok=True)


@app.route("/api/submit", methods=["POST"])
def submit_results():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data received"}), 400

        # Generate filename from Prolific PID and timestamp
        pid = data.get("prolific_pid", "unknown")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{pid}_{timestamp}.json"
        filepath = os.path.join(RESULTS_DIR, filename)

        # Save to file
        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)

        return jsonify({"status": "ok", "filename": filename}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
