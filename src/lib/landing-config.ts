import { z } from "zod";

// Describes the landing page's event-specific content — everything LandingHero/
// PartnershipBanner/SponsorStrip need to render as thin templates instead of literal JSX
// strings, per generalize.md §4/§6 (ported from busherian-hike issue #9). Nested under
// `config.landing` so it stays a distinct concern from `config.fields` (event-fields.ts).
//
// Every field here is optional/defaulted: an event with no `landing` key at all still renders
// a valid (if sparse) homepage — event.name/eventDate/venue/perHeadFee/currency already come
// from the events table itself, so this only covers the marketing-copy layer on top.
const SponsorSchema = z.object({
  name: z.string().trim().min(1),
  // Filename only (not a path) — the logo asset itself lives in `public/`, per issue #9;
  // resolved to `/${logoFilename}` by SponsorStrip.
  logoFilename: z.string().trim().min(1).optional(),
  linkHref: z.url().optional(),
  // Tailwind height utility override for a sponsor whose logo aspect ratio needs it (e.g.
  // "h-9") — defaults to "h-10" in SponsorStrip when omitted.
  logoHeightClass: z.string().trim().min(1).optional(),
  // Tailwind grid-column-start override, same reasoning as busherian-hike's sponsors.ts: grid
  // auto-placement alone can't express "centred under the row above," only an explicit
  // col-start can pull an item onto a specific column of SponsorStrip's 3-column grid.
  gridColStart: z.string().trim().min(1).optional(),
});
export type Sponsor = z.infer<typeof SponsorSchema>;

export const LandingConfigSchema = z.object({
  tagline: z.string().trim().min(1).optional(),
  hostedBy: z.string().trim().min(1).optional(),
  highlights: z.array(z.string().trim().min(1)).default([]),
  pricingCardInclusions: z.array(z.string().trim().min(1)).default([]),
  partnershipSentence: z.string().trim().min(1).optional(),
  sponsors: z.array(SponsorSchema).default([]),
});
export type LandingConfig = z.infer<typeof LandingConfigSchema>;

export function parseLandingConfig(config: Record<string, unknown>): LandingConfig {
  return LandingConfigSchema.parse(config.landing ?? {});
}
