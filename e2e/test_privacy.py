"""E2E coverage for the templated /privacy page (issue #10) — ported from busherian-hike, whose
privacy/page.tsx named one event's data controller as hard-coded JSX. Every assertion here reads
`fixtures/event.json` at test time rather than embedding a copy of its values, per
ONBOARDING.md's "no hardcoded data" rule.
"""

import json
from pathlib import Path

from _common import browser_page

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "event.json").read_text())


def test_privacy_link_navigates_to_notice():
    with browser_page() as page:
        page.goto("/")
        page.get_by_test_id("next-of-kin-privacy-link").click()
        content = page.get_by_test_id("privacy-content")
        content.wait_for(state="visible")
        text = content.inner_text()
        assert FIXTURE["dataControllerName"] in text
        assert f"{FIXTURE['retentionDays']} days" in text
        assert FIXTURE["name"] in text
        assert FIXTURE["name"] in page.title()


def test_privacy_content_reflects_active_event():
    with browser_page() as page:
        page.goto("/privacy")
        content = page.get_by_test_id("privacy-content")
        content.wait_for(state="visible")
        text = content.inner_text()
        assert FIXTURE["dataControllerContact"] in text


def test_next_of_kin_hint_visible_on_registration_form():
    with browser_page() as page:
        page.goto("/")
        hint = page.get_by_test_id("next-of-kin-hint")
        hint.wait_for(state="visible")
        assert "Emergency contact only" in hint.inner_text()


TESTS = [
    test_privacy_link_navigates_to_notice,
    test_privacy_content_reflects_active_event,
    test_next_of_kin_hint_visible_on_registration_form,
]

if __name__ == "__main__":
    for t in TESTS:
        t()
        print(f"PASS {t.__name__}")
