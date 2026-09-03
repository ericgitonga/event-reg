"""E2E coverage for the config-driven landing hero (issue #9).

Unlike busherian-hike's LandingHero (fixed UI copy for one hardcoded event), this component
renders whatever `fixtures/event.json` — the event seeded into CI's own dedicated Turso
database (see `.github/workflows/e2e.yml`) — actually contains. Every assertion here reads that
same fixture file at test time rather than embedding a copy of its values, so the test can never
drift from what's actually seeded (same reasoning as ONBOARDING.md's "no hardcoded data" rule).
"""

import json
from pathlib import Path

from _common import browser_page

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "event.json").read_text())
LANDING = FIXTURE["config"]["landing"]


def test_hero_shows_event_name_and_tagline():
    with browser_page() as page:
        page.goto("/")
        heading = page.get_by_role("heading", name=FIXTURE["name"])
        heading.wait_for(state="visible")

        tagline = page.get_by_test_id("hero-tagline")
        tagline.wait_for(state="visible")
        # `uppercase` (CSS text-transform) means inner_text() reflects the rendered case, not
        # the fixture's original casing — same reasoning as busherian-hike's equivalent test.
        assert tagline.inner_text().lower() == LANDING["tagline"].lower()


def test_hero_shows_every_fixture_highlight():
    with browser_page() as page:
        page.goto("/")
        highlights = page.get_by_test_id("hero-highlights")
        highlights.wait_for(state="visible")
        text = highlights.inner_text()
        for highlight in LANDING["highlights"]:
            assert highlight in text


def test_hero_pricing_shows_fee_and_every_inclusion():
    with browser_page() as page:
        page.goto("/")
        pricing = page.get_by_test_id("hero-pricing")
        pricing.wait_for(state="visible")
        text = pricing.inner_text()
        assert f"{FIXTURE['currency']} {FIXTURE['perHeadFee']}" in text
        for inclusion in LANDING["pricingCardInclusions"]:
            assert inclusion in text


def test_slots_remaining_shows_full_fixture_capacity():
    # Holds as long as no other e2e spec writes a paid registration for this event before this
    # one runs — true today (test_checkin.py/test_payments.py only cover the locked PIN-entry
    # state so far); revisit this assumption once a registration-writing flow gets e2e coverage.
    with browser_page() as page:
        page.goto("/")
        slots = page.get_by_test_id("slots-remaining")
        slots.wait_for(state="visible")
        cap = FIXTURE["capacityCap"]
        assert slots.inner_text() == f"{cap} of {cap} slots remaining"


TESTS = [
    test_hero_shows_event_name_and_tagline,
    test_hero_shows_every_fixture_highlight,
    test_hero_pricing_shows_fee_and_every_inclusion,
    test_slots_remaining_shows_full_fixture_capacity,
]

if __name__ == "__main__":
    for t in TESTS:
        t()
        print(f"PASS {t.__name__}")
