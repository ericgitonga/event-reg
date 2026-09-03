import type { Metadata } from "next";
import LandingHero from "@/components/LandingHero";
import PartnershipBanner from "@/components/PartnershipBanner";
import RegistrationForm from "@/components/RegistrationForm";
import SponsorStrip from "@/components/SponsorStrip";
import { parseEventFields } from "@/lib/event-fields";
import { getActiveEvent } from "@/lib/events-store";
import { parseLandingConfig } from "@/lib/landing-config";
import { getSlotsRemaining } from "@/lib/registrations-store";

// Without this, Next.js would prerender the active event's data once at build time and serve
// that stale snapshot forever — this page must re-query on every request (ported reasoning
// from busherian-hike's equivalent).
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const event = await getActiveEvent();
  const landing = parseLandingConfig(event.config);
  return {
    title: event.name,
    description: landing.tagline ?? event.name,
  };
}

export default async function Home() {
  const event = await getActiveEvent();
  const landing = parseLandingConfig(event.config);
  const customFields = parseEventFields(event.config);
  const remaining = await getSlotsRemaining(event.id, event.capacityCap);
  // VERCEL_ENV is unset outside Vercel (local dev, CI) — treated as non-production too, so the
  // toggle is available everywhere real registrants aren't (ported from busherian-hike #66).
  const isTestEnvironment = process.env.VERCEL_ENV !== "production";

  return (
    <div className="flex flex-1 flex-col items-center bg-white px-4 py-12">
      <main className="w-full max-w-lg">
        <LandingHero event={event} landing={landing} remaining={remaining} />
        <RegistrationForm
          customFields={customFields}
          perHeadFee={event.perHeadFee}
          currency={event.currency}
          paymentProvider={event.paymentProvider}
          paymentConfig={event.paymentConfig}
          isTestEnvironment={isTestEnvironment}
        />
        {landing.partnershipSentence && (
          <PartnershipBanner sentence={landing.partnershipSentence} />
        )}
        {landing.sponsors.length > 0 && <SponsorStrip sponsors={landing.sponsors} />}
      </main>
    </div>
  );
}
