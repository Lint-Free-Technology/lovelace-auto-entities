"""Exercise template subscriptions and update timing through the built card."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timedelta
from pathlib import Path

import pytest
from playwright.sync_api import Page

BUNDLE = Path(__file__).resolve().parents[1] / "dist" / "auto-entities.js"


@pytest.fixture
def template_page(page: Page) -> Iterator[Page]:
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.add_script_tag(path=str(BUNDLE), type="module")
    page.wait_for_function("customElements.get('auto-entities') !== undefined")
    page.evaluate(
        """() => {
            customElements.define('hc-main', class extends HTMLElement {});
            customElements.define('hui-card', class extends HTMLElement {
                load() {
                    this.textContent = JSON.stringify(this.config);
                }
            });
            window.templateCallbacks = new Map();
            window.fixtureHass = {
                states: {},
                user: { name: 'Template test' },
                connection: {
                    async subscribeMessage(callback, message) {
                        if (message.type !== 'render_template') {
                            throw new Error(`Unexpected subscription: ${message.type}`);
                        }
                        const callbacks = templateCallbacks.get(message.template)
                            ?? new Set();
                        callbacks.add(callback);
                        templateCallbacks.set(message.template, callbacks);
                        return async () => {
                            callbacks.delete(callback);
                            if (callbacks.size === 0) {
                                templateCallbacks.delete(message.template);
                            }
                        };
                    },
                },
            };
            const base = document.createElement('hc-main');
            base.hass = fixtureHass;
            document.body.append(base);
            window.mountCard = ({
                template = '{{ first }}', entities = [], withHass = true,
                cardParam = 'entities',
            } = {}) => {
                window.testCard = document.createElement('auto-entities');
                testCard.setConfig({
                    card: { type: cardParam === 'cards' ? 'vertical-stack' : 'entities' },
                    card_param: cardParam,
                    entities,
                    filter: template === null ? {} : { template },
                });
                if (withHass) testCard.hass = fixtureHass;
                document.body.append(testCard);
            };
            window.emitTemplate = (result, template = '{{ first }}') => {
                const callbacks = templateCallbacks.get(template);
                const callback = [...(callbacks ?? [])].at(-1);
                if (!callback) throw new Error(`Missing subscription: ${template}`);
                callback({ result });
            };
            window.cardEntries = (card = testCard) => {
                const config = card.querySelector('hui-card')?.config;
                return config?.entities ?? config?.cards ?? null;
            };
        }"""
    )
    # Control the cooldown deterministically without real-time performance limits.
    start = datetime(2026, 1, 1)
    page.clock.install(time=start)
    page.clock.pause_at(start + timedelta(seconds=1))
    yield page
    page.evaluate("window.testCard?.remove()")
    assert errors == []


@pytest.mark.parametrize(
    ("result", "card_param", "expected"),
    [
        ("light.kitchen, light.hall", "entities", [
            {"entity": "light.kitchen"}, {"entity": "light.hall"},
        ]),
        (["light.kitchen"], "entities", [{"entity": "light.kitchen"}]),
        ([{"type": "tile", "entity": "light.kitchen"}], "cards", [
            {"type": "tile", "entity": "light.kitchen"},
        ]),
    ],
)
def test_first_template_result_renders_immediately(template_page, result, card_param, expected):
    page = template_page
    page.evaluate("cardParam => mountCard({ cardParam })", card_param)
    assert page.evaluate("cardEntries()") == []
    page.clock.run_for(25)
    page.evaluate("result => emitTemplate(result)", result)
    assert page.evaluate("cardEntries()") == expected


def test_template_updates_still_use_cooldown(template_page):
    page = template_page
    page.evaluate("mountCard()")
    page.clock.run_for(25)
    page.evaluate("emitTemplate(['light.first'])")
    assert page.evaluate("cardEntries()") == [{"entity": "light.first"}]
    page.evaluate("emitTemplate(['light.second']); emitTemplate(['light.latest'])")
    page.clock.run_for(499)
    assert page.evaluate("cardEntries()") == [{"entity": "light.first"}]
    page.clock.run_for(1)
    assert page.evaluate("cardEntries()") == [{"entity": "light.latest"}]
    page.evaluate("emitTemplate('')")
    page.clock.run_for(500)
    assert page.evaluate("cardEntries()") == []


def test_empty_list_is_a_resolved_template_result(template_page):
    page = template_page
    page.evaluate("mountCard()")
    page.clock.run_for(25)
    page.evaluate("emitTemplate([])")
    page.evaluate("emitTemplate(['light.later'])")
    page.clock.run_for(499)
    assert page.evaluate("cardEntries()") == []
    page.clock.run_for(1)
    assert page.evaluate("cardEntries()") == [{"entity": "light.later"}]


def test_empty_string_is_a_resolved_template_result(template_page):
    page = template_page
    page.evaluate("mountCard()")
    page.clock.run_for(25)
    page.evaluate("emitTemplate('')")
    page.evaluate("emitTemplate(['light.later'])")
    page.clock.run_for(499)
    assert page.evaluate("cardEntries()") == []
    page.clock.run_for(1)
    assert page.evaluate("cardEntries()") == [{"entity": "light.later"}]


def test_changed_template_renders_its_first_result_immediately(template_page):
    page = template_page
    page.evaluate("mountCard()")
    page.evaluate("emitTemplate(['light.first'])")
    assert page.evaluate("cardEntries()") == [{"entity": "light.first"}]
    page.evaluate(
        """testCard.setConfig({
            card: { type: 'entities' }, filter: { template: '{{ second }}' },
        })"""
    )
    page.clock.run_for(25)
    page.evaluate("emitTemplate(['light.second'], '{{ second }}')")
    assert page.evaluate("cardEntries()") == [{"entity": "light.second"}]


def test_changed_template_config_renders_first_result_immediately(template_page):
    page = template_page
    page.evaluate("mountCard()")
    page.clock.run_for(25)
    page.evaluate("emitTemplate(['light.first'])")
    assert page.evaluate("cardEntries()") == [{"entity": "light.first"}]
    page.evaluate(
        """testCard.setConfig({
            card: { type: 'entities' },
            entities: ['light.static'],
            filter: { template: '{{ first }}' },
        })"""
    )
    page.clock.run_for(25)
    page.evaluate("emitTemplate(['light.second'])")
    assert page.evaluate("cardEntries()") == [
        {"entity": "light.static"}, {"entity": "light.second"},
    ]


def test_template_result_updates_existing_entities_immediately(template_page):
    page = template_page
    page.evaluate("mountCard({ entities: ['light.static'] })")
    assert page.evaluate("cardEntries()") == [{"entity": "light.static"}]
    page.clock.run_for(25)
    page.evaluate("emitTemplate(['light.template'])")
    assert page.evaluate("cardEntries()") == [
        {"entity": "light.static"}, {"entity": "light.template"},
    ]


@pytest.mark.parametrize("template", [None, "{{ first }}"])
def test_update_without_hass_does_not_delay_first_render(template_page, template):
    page = template_page
    page.evaluate(
        "template => mountCard({ template, entities: ['light.first'], withHass: false })",
        template,
    )
    expected = [{"entity": "light.first"}]
    if template:
        page.evaluate("emitTemplate(['light.template'])")
        expected.append({"entity": "light.template"})
    assert page.evaluate("cardEntries()") is None
    page.clock.run_for(25)
    page.evaluate("testCard.hass = fixtureHass")
    assert page.evaluate("cardEntries()") == expected


def test_fresh_mount_renders_first_template_result_immediately(template_page):
    page = template_page
    page.evaluate("mountCard()")
    page.evaluate("emitTemplate(['light.first'])")
    assert page.evaluate("cardEntries()") == [{"entity": "light.first"}]
    page.evaluate("testCard.remove()")
    page.evaluate("mountCard()")
    page.clock.run_for(25)
    page.evaluate("emitTemplate(['light.second'])")
    assert page.evaluate("cardEntries()") == [{"entity": "light.second"}]


def test_reconnected_card_renders_first_result_immediately(template_page):
    page = template_page
    page.evaluate("mountCard()")
    page.clock.run_for(25)
    page.evaluate("emitTemplate(['light.first'])")
    assert page.evaluate("cardEntries()") == [{"entity": "light.first"}]
    page.evaluate("testCard.remove()")
    page.evaluate("document.body.append(testCard)")
    page.clock.run_for(25)
    page.evaluate("emitTemplate(['light.second'])")
    assert page.evaluate("cardEntries()") == [{"entity": "light.second"}]


def test_reattached_card_keeps_last_result_until_new_one(template_page):
    page = template_page
    page.evaluate("mountCard()")
    page.clock.run_for(25)
    page.evaluate("emitTemplate(['light.first'])")
    page.evaluate("testCard.remove()")
    page.evaluate("document.body.append(testCard)")
    page.clock.run_for(600)
    assert page.evaluate("cardEntries()") == [{"entity": "light.first"}]
    page.evaluate("emitTemplate(['light.second'])")
    assert page.evaluate("cardEntries()") == [{"entity": "light.second"}]


def test_reattached_card_keeps_last_result_until_fresh_result(template_page):
    page = template_page
    page.evaluate("mountCard()")
    page.clock.run_for(25)
    page.evaluate("emitTemplate(['light.first'])")
    page.evaluate("testCard.remove()")
    page.evaluate("document.body.append(testCard)")
    assert page.evaluate("cardEntries()") == [{"entity": "light.first"}]
    page.evaluate("emitTemplate(['light.second'])")
    assert page.evaluate("cardEntries()") == [{"entity": "light.second"}]
    assert page.evaluate("templateCallbacks.get('{{ first }}').size") == 1


def test_detached_template_unsubscribes_immediately(template_page):
    page = template_page
    page.evaluate("mountCard()")
    page.evaluate("testCard.remove()")
    assert not page.evaluate("templateCallbacks.has('{{ first }}')")


def test_late_result_from_closed_subscription_is_ignored(template_page):
    page = template_page
    page.evaluate("mountCard()")
    page.evaluate(
        "() => { window.oldCallback = [...templateCallbacks.get('{{ first }}')].at(-1); }"
    )
    page.evaluate(
        """Object.defineProperty(document, 'hidden', {
            configurable: true, get: () => true,
        })"""
    )
    page.evaluate("testCard.remove()")
    page.evaluate("mountCard()")
    # A result the old subscription sent before it closed arrives late.
    page.evaluate("oldCallback({ result: ['light.stale'] })")
    assert page.evaluate("cardEntries()") != [{"entity": "light.stale"}]
    page.evaluate("emitTemplate(['light.fresh'])")
    assert page.evaluate("cardEntries()") == [{"entity": "light.fresh"}]


def test_template_cache_is_not_shared_with_card_mod(template_page):
    page = template_page
    page.evaluate("mountCard()")
    assert page.evaluate("Object.keys(window.cardMod_template_cache ?? {})") == []
    assert len(page.evaluate("Object.keys(window.autoEntities_template_cache)")) == 1


def test_reattached_card_renders_latest_shared_template_result(template_page):
    page = template_page
    page.evaluate("mountCard()")
    page.clock.run_for(25)
    page.evaluate("emitTemplate(['light.first'])")
    page.evaluate(
        """() => {
            window.secondCard = document.createElement('auto-entities');
            secondCard.setConfig({
                card: { type: 'entities' },
                card_param: 'entities',
                entities: [],
                filter: { template: '{{ first }}' },
            });
            secondCard.hass = fixtureHass;
            document.body.append(secondCard);
        }"""
    )
    assert page.evaluate("cardEntries(secondCard)") == [{"entity": "light.first"}]
    page.evaluate("secondCard.remove(); emitTemplate(['light.second'])")
    page.evaluate("document.body.append(secondCard)")
    assert page.evaluate("cardEntries(secondCard)") == [{"entity": "light.second"}]


def test_many_area_card_template_results_render_and_reattach(template_page):
    """Exercise the reported card shape at the reported scale (56 areas)."""
    page = template_page
    page.evaluate("mountCard({ cardParam: 'cards' })")
    page.clock.run_for(25)
    page.evaluate(
        """emitTemplate(Array.from({ length: 56 }, (_, i) => ({
            type: 'area',
            area: `area_${i}`,
            navigation_path: `/dashboard-areas/areas-area_${i}`,
            sensor_classes: ['temperature', 'humidity', 'illuminance'],
            alert_classes: ['motion', 'moisture', 'running', 'garage_door'],
        })))"""
    )
    assert page.evaluate("cardEntries().length") == 56
    # A new element models the preview created when the dashboard editor opens.
    # It must stay empty until its own template result arrives.
    page.evaluate("testCard.remove(); mountCard({ cardParam: 'cards' })")
    page.clock.run_for(25)
    assert page.evaluate("cardEntries()") == []
    page.evaluate(
        """emitTemplate(Array.from({ length: 56 }, (_, i) => ({
            type: 'area',
            area: `area_${i}`,
            navigation_path: `/dashboard-areas/areas-area_${i}`,
            sensor_classes: ['temperature', 'humidity', 'illuminance'],
            alert_classes: ['motion', 'moisture', 'running', 'garage_door'],
        })))"""
    )
    assert page.evaluate("cardEntries().length") == 56
