import { z } from "zod";

// Describes the volatile intro-block fields for /terms and /privacy (issue #10) — narrowly-
// templated pages porting busherian-hike's fixed 18-section waiver/privacy-notice structure
// rather than freeform per-event Markdown, per generalize.md §5's recommendation. Event
// name/date/venue and the DPA controller's name/contact already live on the events table's own
// columns; this only covers the terms page's "FOR <entity>" / "Organiser:" / "Email:" intro
// lines, which have no other home. Nested under `config.legal`, same convention as
// `config.landing`/`config.fields`.
//
// Unlike LandingConfigSchema, every field here is required with no default: these pages are the
// thing a participant ticks the Acknowledgement checkbox against, so a misconfigured event
// should fail loudly at render time rather than silently publish a page missing who's actually
// running the activity.
export const LegalConfigSchema = z.object({
  // The activity/business name the waiver is "FOR" — e.g. "Alliance Classic Run Outdoor
  // Activities and Events" — which may differ from both the event's own name and the
  // organiser's name below.
  entityName: z.string().trim().min(1),
  organiserName: z.string().trim().min(1),
  organiserEmail: z.string().trim().min(1),
});
export type LegalConfig = z.infer<typeof LegalConfigSchema>;

export function parseLegalConfig(config: Record<string, unknown>): LegalConfig {
  return LegalConfigSchema.parse(config.legal ?? {});
}
