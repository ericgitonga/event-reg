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


TESTS = [test_homepage_loads, test_health_endpoint]

if __name__ == "__main__":
    for t in TESTS:
        t()
        print(f"PASS {t.__name__}")
