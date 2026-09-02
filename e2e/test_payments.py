"""Payments page golden path — only the locked (PIN-entry) state, which needs no live
event/database. The PIN-unlock, mark-paid, and export flows need a real seeded event and aren't
covered here yet — see issue #9's CI-database work.
"""

from _common import browser_page


def test_payments_page_loads_locked():
    with browser_page() as page:
        resp = page.goto("/payments")
        assert resp.status == 200
        page.wait_for_selector('[data-testid="payments-pin-input"]')


TESTS = [test_payments_page_loads_locked]

if __name__ == "__main__":
    for t in TESTS:
        t()
        print(f"PASS {t.__name__}")
