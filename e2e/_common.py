"""Shared helpers for the Playwright E2E smoke suite.

Written against the Python `playwright` package (the `ds` conda env already has it installed
with browsers pre-cached), not `@playwright/test` — deliberate, so Python tooling doesn't need
a parallel npm toolchain. Specs are plain scripts (`TESTS = [...]` list of functions,
`assert`-based), run via:

    npm run build && npm start   # in one terminal
    conda run -n ds python e2e/run.py   # in another

BASE_URL overrides the default local server; CI points it at a locally built-and-started server
(see .github/workflows/e2e.yml) rather than a live Vercel Preview URL, to avoid depending on
Vercel's own deployment-webhook timing.

Never assert against `page.text_content("body")` (or any unscoped page-level text locator) on
this app. Next.js App Router embeds the full RSC hydration payload — the unfiltered underlying
data, serialized — inside a <script> tag in the page, and `textContent` includes script-tag
contents. An assertion like `"X" not in page.text_content("body")` can pass or fail for the
wrong reason regardless of what's actually rendered/filtered on screen. Scope every locator to a
`data-testid` on the actual container you care about instead.
"""

import os
from contextlib import contextmanager

from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000").rstrip("/")


@contextmanager
def browser_page():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page(base_url=BASE_URL)
            yield page
        finally:
            browser.close()
