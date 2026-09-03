import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Baseline hardening (issue #29, Medium finding M2): without X-Frame-Options, /checkin and
  // /payments — the pages where an organiser types their PIN — could be embedded in an
  // attacker-controlled iframe, enabling a clickjacking overlay attack against PIN entry. A
  // full Content-Security-Policy is a larger, separate effort (Next.js inline scripts/styles
  // need careful nonce handling) — deliberately out of scope here.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
