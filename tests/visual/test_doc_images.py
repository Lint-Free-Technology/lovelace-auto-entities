from __future__ import annotations

import pytest
from ha_testcontainer import HATestContainer
from playwright.sync_api import Page

from ha_testcontainer.visual.scenario_runner import (
    capture_doc_animation,
    capture_doc_image,
    clear_scenario,
    goto_scenario,
    load_all_doc_image_scenarios,
    push_scenario,
    reset_theme,
    run_interactions,
    set_theme,
)

_DOC_SCENARIOS = load_all_doc_image_scenarios()
_DOC_SCENARIO_IDS = [s["id"] for s in _DOC_SCENARIOS]
_DOC_SCENARIO_MAP = {s["id"]: s for s in _DOC_SCENARIOS}


@pytest.mark.parametrize("scenario_id", _DOC_SCENARIO_IDS)
def test_doc_image(
    scenario_id: str,
    ha: HATestContainer,
    ha_page: Page,
    ha_url: str,
    ha_lovelace_url_path: str,
) -> None:
    scenario = _DOC_SCENARIO_MAP[scenario_id]
    theme = scenario.get("theme")

    push_scenario(ha, ha_lovelace_url_path, scenario)
    if theme:
        set_theme(ha, theme)

    try:
        run_interactions(ha_page, scenario, ha=ha, key="setup")
        goto_scenario(ha_page, ha_url, ha_lovelace_url_path, scenario["view_path"])
        run_interactions(ha_page, scenario, ha=ha)
        capture_doc_image(ha_page, scenario, ha=ha)
        capture_doc_animation(ha_page, scenario, ha=ha)
    finally:
        run_interactions(ha_page, scenario, ha=ha, key="teardown")
        if theme:
            reset_theme(ha)
        clear_scenario(ha, ha_lovelace_url_path)