"""E2E coverage for the templated /terms page (issue #10) — ported from busherian-hike, whose
terms/page.tsx reproduced one event's waiver as hard-coded JSX. Every assertion here reads
`fixtures/event.json` at test time rather than embedding a copy of its values, per
ONBOARDING.md's "no hardcoded data" rule.
"""

import json
from pathlib import Path

from _common import browser_page

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "event.json").read_text())
LEGAL = FIXTURE["config"]["legal"]


def test_terms_link_navigates_to_terms_page():
    with browser_page() as page:
        page.goto("/")
        # The link opens in a new tab (target="_blank") since it sits inside the registration
        # form, which the participant shouldn't lose their in-progress entries by navigating
        # away from.
        with page.context.expect_page() as new_page_info:
            page.get_by_test_id("field-termsAccepted").locator(
                "xpath=following-sibling::span//a"
            ).click()
        terms_page = new_page_info.value
        terms_page.wait_for_load_state()
        content = terms_page.get_by_test_id("terms-content")
        content.wait_for(state="visible")
        text = content.inner_text()
        assert FIXTURE["name"] in text
        assert "Acceptance of these terms" in text
        assert "Photography, video and audio recording" in text
        assert "Data protection and privacy" in text
        assert FIXTURE["name"] in terms_page.title()


def test_terms_content_reflects_active_event_and_legal_config():
    with browser_page() as page:
        page.goto("/terms")
        content = page.get_by_test_id("terms-content")
        content.wait_for(state="visible")
        text = content.inner_text()
        assert LEGAL["entityName"] in text
        assert LEGAL["organiserName"] in text
        assert LEGAL["organiserEmail"] in text
        assert FIXTURE["venue"] in text
        assert FIXTURE["dataControllerName"] in text
        assert FIXTURE["dataControllerContact"] in text


def test_acknowledgement_and_media_consent_sections_visible():
    with browser_page() as page:
        page.goto("/")
        page.get_by_test_id("field-termsAccepted").wait_for(state="visible")
        page.get_by_test_id("media-consent-yes").wait_for(state="visible")
        page.get_by_test_id("media-consent-no").wait_for(state="visible")

        # Neither option is pre-selected — the source waiver requires an explicit choice.
        assert not page.get_by_test_id("media-consent-yes").is_checked()
        assert not page.get_by_test_id("media-consent-no").is_checked()
        assert not page.get_by_test_id("field-termsAccepted").is_checked()


TESTS = [
    test_terms_link_navigates_to_terms_page,
    test_terms_content_reflects_active_event_and_legal_config,
    test_acknowledgement_and_media_consent_sections_visible,
]

if __name__ == "__main__":
    for t in TESTS:
        t()
        print(f"PASS {t.__name__}")
