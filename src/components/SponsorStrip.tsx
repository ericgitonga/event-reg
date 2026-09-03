import Image from "next/image";
import type { Sponsor } from "@/lib/landing-config";

// Ported and generalized from busherian-hike's SponsorStrip.tsx/sponsors.ts (issue #9): the
// sponsor list itself moves from a hardcoded TypeScript constant to `config.landing.sponsors`,
// so this is now a thin template over whatever list the active event's config provides. Logo
// assets stay in `public/`, referenced by filename only. Only rendered by page.tsx when the
// list is non-empty.
export default function SponsorStrip({ sponsors }: { sponsors: Sponsor[] }) {
  return (
    <div
      data-testid="sponsor-strip"
      className="mt-6 flex flex-col items-center gap-2 border-t border-zinc-200 pt-6"
    >
      <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">With thanks to</p>
      <ul className="grid grid-cols-3 items-center justify-items-center gap-4">
        {sponsors.map((sponsor) => {
          const content = sponsor.logoFilename ? (
            <Image
              src={`/${sponsor.logoFilename}`}
              alt={sponsor.name}
              width={160}
              height={160}
              className={`${sponsor.logoHeightClass ?? "h-10"} w-auto object-contain`}
            />
          ) : (
            sponsor.name
          );

          return (
            <li
              key={sponsor.name}
              className={`text-sm font-semibold text-zinc-800 ${sponsor.gridColStart ?? ""}`}
            >
              {sponsor.linkHref ? (
                <a
                  href={sponsor.linkHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-zinc-600"
                >
                  {content}
                </a>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
