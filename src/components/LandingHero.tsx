import SlotsRemaining from "@/components/SlotsRemaining";
import type { Event } from "@/lib/events-store";
import type { LandingConfig } from "@/lib/landing-config";

// A thin template over the active event's own columns (name/eventDate/venue/perHeadFee/
// currency) plus its `config.landing` copy — ported and generalized from busherian-hike's
// LandingHero.tsx (issue #9), which rendered all of this as literal JSX strings for one
// hardcoded event.
const EVENT_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default function LandingHero({
  event,
  landing,
  remaining,
}: {
  event: Event;
  landing: LandingConfig;
  remaining: number;
}) {
  const dateAndVenue = [EVENT_DATE_FORMAT.format(new Date(event.eventDate)), event.venue]
    .filter(Boolean)
    .join(" — ");

  return (
    <header className="mb-8 text-center">
      {landing.tagline && (
        <p
          data-testid="hero-tagline"
          className="mb-3 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold tracking-wide text-amber-800 uppercase"
        >
          {landing.tagline}
        </p>
      )}

      <h1 className="text-2xl font-semibold text-zinc-900">{event.name}</h1>
      {landing.hostedBy && <p className="mt-1 text-sm text-zinc-600">{landing.hostedBy}</p>}
      <p className="mt-1 text-sm text-zinc-600">{dateAndVenue}</p>

      {landing.highlights.length > 0 && (
        <ul
          data-testid="hero-highlights"
          className="mx-auto mt-4 flex max-w-sm flex-col gap-1 text-left text-sm text-zinc-700"
        >
          {landing.highlights.map((highlight, index) => (
            <li key={index}>{highlight}</li>
          ))}
        </ul>
      )}

      {landing.pricingCardInclusions.length > 0 && (
        <div className="mt-6">
          <div
            data-testid="hero-pricing"
            className="mx-auto mt-3 max-w-md rounded-md border border-zinc-200 p-4 text-left"
          >
            <p className="text-lg font-bold text-zinc-900">
              {event.currency} {event.perHeadFee}
            </p>
            <ul className="mt-2 list-inside list-disc text-xs text-zinc-600">
              {landing.pricingCardInclusions.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <SlotsRemaining remaining={remaining} cap={event.capacityCap} />
    </header>
  );
}
