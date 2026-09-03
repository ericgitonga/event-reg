"""E2E coverage for the config-driven sponsor strip (issue #9). See test_landing_hero.py for why
this reads `fixtures/event.json` rather than asserting a copy of its values.

The fixture's two sponsors are both text-only (no `logoFilename`) by design — deliberately not
covering the Image-rendering branch here, since that would need a real binary logo asset checked
in purely for a CI fixture. That branch is a straightforward `/${logoFilename}` src computation,
low-risk and already proven in busherian-hike's production use of the same component shape.
"""

import json
from pathlib import Path

from _common import browser_page

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "event.json").read_text())
SPONSORS = FIXTURE["config"]["landing"]["sponsors"]


def test_sponsor_strip_shows_every_fixture_sponsor():
    with browser_page() as page:
        page.goto("/")
        strip = page.get_by_test_id("sponsor-strip")
        strip.wait_for(state="visible")
        text = strip.inner_text()
        for sponsor in SPONSORS:
            assert sponsor["name"] in text


def test_sponsor_with_link_href_renders_as_a_link():
    with browser_page() as page:
        page.goto("/")
        strip = page.get_by_test_id("sponsor-strip")
        strip.wait_for(state="visible")
        linked = next(s for s in SPONSORS if s.get("linkHref"))
        link = strip.get_by_role("link", name=linked["name"])
        assert link.get_attribute("href") == linked["linkHref"]


def test_sponsor_without_link_href_renders_without_a_link():
    with browser_page() as page:
        page.goto("/")
        strip = page.get_by_test_id("sponsor-strip")
        strip.wait_for(state="visible")
        unlinked = next(s for s in SPONSORS if not s.get("linkHref"))
        assert strip.get_by_role("link", name=unlinked["name"]).count() == 0


TESTS = [
    test_sponsor_strip_shows_every_fixture_sponsor,
    test_sponsor_with_link_href_renders_as_a_link,
    test_sponsor_without_link_href_renders_without_a_link,
]

if __name__ == "__main__":
    for t in TESTS:
        t()
        print(f"PASS {t.__name__}")
