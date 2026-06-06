from __future__ import annotations

import os
from functools import partial
from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parent.parent

os.environ.setdefault("HA_CONFIG_PATH", str(REPO_ROOT / "tests" / "ha-config"))
os.environ.setdefault("HA_PLUGINS_YAML", str(REPO_ROOT / "tests" / "plugins.yaml"))
os.environ.setdefault("HA_INTEGRATIONS_YAML", str(REPO_ROOT / "tests" / "integrations.yaml"))

import ha_testcontainer.visual.scenario_runner as _sr  # noqa: E402

_sr.SCENARIOS_DIR = REPO_ROOT / "tests" / "visual" / "scenarios"
_sr.SNAPSHOTS_DIR = REPO_ROOT / "tests" / "visual" / "snapshots"
_sr.REPO_ROOT = REPO_ROOT
_sr.DOCS_SCENARIOS_DIR = _sr.REPO_ROOT / "docs" / "scenarios"

# Ensure snapshot assertions always read/write baselines in this repository.
# conftest is imported before tests are collected, so this override is active for test runs.
_sr.assert_snapshot = partial(_sr.assert_snapshot, snapshots_dir=_sr.SNAPSHOTS_DIR)

# ---------------------------------------------------------------------------
# Make tests/visual/ importable so test_extensions can be imported before
# pytest adds it to sys.path during collection.
# ---------------------------------------------------------------------------

sys.path.insert(0, str(Path(__file__).parent / "visual"))