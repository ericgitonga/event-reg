"""Golden-path smoke checks. Extend with real specs as pages/flows are built."""

from _common import BASE_URL, browser_page


def test_homepage_loads():
    with browser_page() as page:
        resp = page.goto("/")
        assert resp.status == 200


def test_health_endpoint():
    with browser_page() as page:
        resp = page.request.get(f"{BASE_URL}/api/health")
        assert resp.status == 200
        assert resp.json() == {"status": "ok"}


def test_security_headers_present_on_every_page():
    # Regression coverage for issue #29 (Medium, extras/security-audit.md finding M2) —
    # specifically guards /checkin against clickjacking, since that's the page an organiser
    # types their PIN into.
    with browser_page() as page:
        resp = page.goto("/checkin")
        assert resp.headers.get("x-frame-options") == "DENY"
        assert resp.headers.get("x-content-type-options") == "nosniff"
        assert resp.headers.get("referrer-policy") == "strict-origin-when-cross-origin"


TESTS = [test_homepage_loads, test_health_endpoint, test_security_headers_present_on_every_page]

if __name__ == "__main__":
    for t in TESTS:
        t()
        print(f"PASS {t.__name__}")
