# auto-entities tests

This repository uses [ha-testcontainer](https://github.com/Lint-Free-Technology/ha-testcontainer)
for Home Assistant visual tests.

## Prerequisites

- Docker
- Python 3.11+
- Node dependencies installed and build generated (`npm ci && npm run build`)

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e '.[test]'
playwright install --with-deps chromium
```

## Browser smoke tests

After building the card, run the smoke batch with the same Python and Playwright
dependencies:

```bash
npm run build
pytest @tests/smoke.txt
# or:
make smoke
```

The shared selection is maintained in [`smoke.txt`](smoke.txt), with one test
path per line relative to the repository root. Add new smoke test files there;
the VS Code **pytest: Smoke tests (no scenarios)** task and `make smoke` use the
same list. This uses pytest's argument-file support (pytest 8.2+, included in the
test dependencies). Additional filters work as usual, for example
`pytest @tests/smoke.txt -k numeric_comparison`.

These tests load the built card in Chromium with synthetic Home Assistant states
and inspect the entities passed to its inner card. They do not start Home Assistant
or compare screenshots.

## Setup and run tests (VS Code tasks or CLI)

Home Assistant test version is read from `tests/HA_VERSION`.

### VS Code tasks

Open **Run Task...** and use:

- `Python: Set up virtual environment`
- `HA: Start persistent server` (optional when iterating)
- `pytest: Smoke tests (no scenarios)`
- `pytest: Visual scenarios`
- `pytest: Visual scenarios (Update)`
- `pytest: Visual scenario - single`
- `pytest: Doc images`
- `pytest: Doc images (Update)`

### CLI

```bash
pytest tests/visual/test_scenarios.py
pytest tests/visual/test_doc_images.py
# run an individual scenario while iterating locally
pytest tests/visual/test_scenarios.py -k 03_light_attributes
# update visual scenario baselines
SNAPSHOT_UPDATE=1 pytest tests/visual/test_scenarios.py
```

## Update generated documentation images

```bash
DOC_IMAGE_UPDATE=1 pytest tests/visual/test_doc_images.py
```

Documentation-only image scenarios live in `docs/scenarios/*.yaml`.
