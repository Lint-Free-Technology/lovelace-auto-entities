"""Exercise filters through the built card with synthetic Home Assistant states."""

from __future__ import annotations

from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import pytest
from playwright.sync_api import Page

BUNDLE = Path(__file__).resolve().parents[1] / "dist" / "auto-entities.js"


@pytest.fixture
def select_entities(page: Page) -> Iterator[Callable[..., list[str]]]:
    """Load the real card and expose the entities passed to its inner card."""
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.add_script_tag(path=str(BUNDLE), type="module")
    page.wait_for_function("customElements.get('auto-entities') !== undefined")
    page.evaluate(
        """() => {
            class FixtureCard extends HTMLElement {
                load() {
                    this.textContent = this.config.entities
                        .map(entity => entity.entity).join(',');
                }
                getCardSize() { return 1; }
            }
            customElements.define('hui-card', FixtureCard);
        }"""
    )

    def select(values: list[Any], rule: dict[str, Any], mode: str = "include") -> list[str]:
        return page.evaluate(
            """async ({ values, rule, mode }) => {
                const states = Object.fromEntries(values.map((value, index) => {
                    const entity_id = `sensor.test_${index}`;
                    return [entity_id, {
                        entity_id,
                        state: String(value),
                        attributes: { level: value },
                    }];
                }));
                const registryEvents = [
                    'entity_registry_updated', 'device_registry_updated',
                    'area_registry_updated', 'floor_registry_updated',
                    'label_registry_updated',
                ];
                const registryCalls = [
                    'config/entity_registry/list', 'config/device_registry/list',
                    'config/area_registry/list', 'config/floor_registry/list',
                    'config/label_registry/list',
                ];
                const card = document.createElement('auto-entities');
                card.setConfig({
                    card: { type: 'entities' },
                    filter: mode === 'include'
                        ? { include: [{ domain: 'sensor', ...rule }] }
                        : { include: [{ domain: 'sensor' }], exclude: [rule] },
                });
                card.hass = {
                    states,
                    connection: {
                        async subscribeEvents(_callback, type) {
                            if (!registryEvents.includes(type)) {
                                throw new Error(`Unexpected subscription: ${type}`);
                            }
                            return () => {};
                        },
                    },
                    async callWS({ type }) {
                        if (!registryCalls.includes(type)) {
                            throw new Error(`Unexpected request: ${type}`);
                        }
                        return [];
                    },
                };
                document.body.append(card);
                try {
                    await Promise.race([
                        card.getCardSize(),
                        new Promise((_, reject) => setTimeout(
                            () => reject(new Error('Card build timed out')), 3000
                        )),
                    ]);
                    await card.updateComplete;
                    const text = card.querySelector('hui-card')?.textContent;
                    return text ? text.split(',') : [];
                } finally {
                    card.remove();
                }
            }""",
            {"values": values, "rule": rule, "mode": mode},
        )

    yield select
    assert errors == []


@pytest.mark.parametrize("field", ["state", "attribute"])
@pytest.mark.parametrize("mode", ["include", "exclude"])
@pytest.mark.parametrize(
    ("operator", "included"),
    [
        ("!=", [0, 2]),
        ("!", [0, 2]),
        ("=", [1]),
        ("==", [1]),
        ("<", [0]),
        ("<=", [0, 1]),
        (">", [2]),
        (">=", [1, 2]),
    ],
)
def test_numeric_comparison(select_entities, field, mode, operator, included):
    """Keep state and attribute comparisons consistent in both filter lists."""
    pattern = f"{operator} 12"
    rule = {"state": pattern} if field == "state" else {"attributes": {"level": pattern}}
    expected = (
        included
        if mode == "include"
        else [index for index in range(3) if index not in included]
    )
    assert select_entities([11, 12, 13], rule, mode) == [
        f"sensor.test_{index}" for index in expected
    ]


@pytest.mark.parametrize("operator", ["!=", "!"])
@pytest.mark.parametrize("threshold", [0, -2, 1.25])
def test_zero_negative_and_fractional_values(select_entities, operator, threshold):
    """Exclude numerically equal states beyond positive integers."""
    assert select_entities(
        [threshold, threshold + 1], {"state": f"{operator}{threshold}"}
    ) == ["sensor.test_1"]


@pytest.mark.parametrize("operator", ["!=", "!"])
def test_equivalent_numeric_values(select_entities, operator):
    """Exclude both integer and decimal spellings of an equal numeric state."""
    assert select_entities(
        [11, 12, "12.0", "12.00", 13], {"state": f"{operator} 12"}
    ) == ["sensor.test_0", "sensor.test_4"]


def test_selector_choice(select_entities):
    """Apply numeric inequality selected through a choose-selector value."""
    assert select_entities(
        ["12.0", "13"],
        {"state": {"value": {"active_choice": "numeric", "numeric": "!= 12"}}},
    ) == ["sensor.test_1"]


@pytest.mark.parametrize(
    ("pattern", "ignore_case", "values", "expected"),
    [
        ("12", False, ["12", "12.0"], ["sensor.test_0"]),
        ("Home", False, ["Home", "HOME", "away"], ["sensor.test_0"]),
        ("Home", True, ["Home", "HOME", "away"], ["sensor.test_0", "sensor.test_1"]),
        (
            "/^sensor\\.demo_/",
            False,
            ["sensor.demo_one", "SENSOR.DEMO_TWO", "sensor.other"],
            ["sensor.test_0"],
        ),
        (
            "/^sensor\\.demo_/",
            True,
            ["sensor.demo_one", "SENSOR.DEMO_TWO", "sensor.other"],
            ["sensor.test_0", "sensor.test_1"],
        ),
    ],
)
def test_literal_and_regex_filters(select_entities, pattern, ignore_case, values, expected):
    """Retain string matching and optional case folding."""
    assert select_entities(
        values, {"state": {"value": pattern, "ignore_case": ignore_case}}
    ) == expected
