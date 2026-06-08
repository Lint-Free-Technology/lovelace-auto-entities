from __future__ import annotations

import pytest
from playwright.sync_api import BrowserContext, Page

from ha_testcontainer.visual import HA_SETTLE_MS, PAGE_LOAD_TIMEOUT, inject_ha_token

__all__ = ["HA_SETTLE_MS", "PAGE_LOAD_TIMEOUT"]


@pytest.fixture(scope="session")
def ha_browser_context(browser, ha_url: str, ha_token: str) -> BrowserContext:
    context = browser.new_context(
        viewport={"width": 1280, "height": 800},
        ignore_https_errors=True,
    )
    page = context.new_page()
    inject_ha_token(page, ha_url, ha_token)
    page.wait_for_load_state("networkidle", timeout=PAGE_LOAD_TIMEOUT)
    page.close()
    yield context
    context.close()


@pytest.fixture()
def ha_page(ha_browser_context: BrowserContext) -> Page:
    page = ha_browser_context.new_page()
    yield page
    page.close()