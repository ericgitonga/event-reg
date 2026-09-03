"""E2E coverage for the config-driven partnership banner (issue #9). See test_landing_hero.py
for why this reads `fixtures/event.json` rather than asserting a literal copy of its text.
"""

import json
from pathlib import Path

from _common import browser_page

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "event.json").read_text())
LANDING = FIXTURE["config"]["landing"]


def test_partnership_banner_shows_fixture_sentence():
    with browser_page() as page:
        page.goto("/")
        banner = page.get_by_test_id("partnership-banner")
        banner.wait_for(state="visible")
        assert banner.inner_text() == LANDING["partnershipSentence"]


TESTS = [test_partnership_banner_shows_fixture_sentence]

if __name__ == "__main__":
    for t in TESTS:
        t()
        print(f"PASS {t.__name__}")
