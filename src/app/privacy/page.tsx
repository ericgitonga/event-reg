import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";
import { getActiveEvent } from "@/lib/events-store";

// Without this, Next.js would prerender the active event's data once at build time and serve
// that stale snapshot forever — same reasoning as the homepage (src/app/page.tsx).
export const dynamic = "force-dynamic";

// ISO date (e.g. "2026-09-19") -> "19 September 2026", fixed to UTC so the date shown on a
// legal document never shifts a day depending on the server's local timezone.
function formatEventDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function generateMetadata(): Promise<Metadata> {
  const event = await getActiveEvent();
  return { title: `Privacy Notice — ${event.name}` };
}

// Reproduces busherian-hike's privacy/page.tsx as a narrowly-templated page (issue #10,
// generalize.md §5): the prose structure is fixed, and only the volatile fields — event
// name/date, and the DPA controller's name/contact/retention window (the active event's own
// columns) — are interpolated. Unlike busherian-hike's version, "What we collect" is kept
// generic rather than naming specific fields, since which custom fields an event actually asks
// for is itself config-driven (src/lib/event-fields.ts) and varies per event.
export default async function PrivacyPage() {
  const event = await getActiveEvent();

  return (
    <div className="flex flex-1 flex-col items-center bg-white px-4 py-12">
      <main className="w-full max-w-lg">
        <Breadcrumb
          data-testid="privacy-breadcrumb"
          items={[{ label: "Register", href: "/" }, { label: "Privacy Notice" }]}
        />
        <h1 className="text-2xl font-semibold text-zinc-900">Privacy Notice</h1>
        <div
          data-testid="privacy-content"
          className="mt-6 flex flex-col gap-4 text-sm leading-6 text-zinc-700"
        >
          <p>
            This notice covers the data collected through this site&apos;s registration form for{" "}
            {event.name}, {formatEventDate(event.eventDate)}.
          </p>

          <section>
            <h2 className="font-semibold text-zinc-900">Data controller</h2>
            <p>
              <strong>{event.dataControllerName}</strong> is the data controller of record for
              this event.
              <br />
              <strong>Contact:</strong> {event.dataControllerContact}
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-zinc-900">What we collect, and why</h2>
            <p>
              Your registration details, guest count, and any additional information this
              event&apos;s registration form asks for — collected to process your registration
              and organise the event. Next-of-kin name and contact are collected for emergency
              purposes only, in case something goes wrong at the event.
            </p>
            <p className="mt-2">
              <strong>If you list a next-of-kin contact, please make sure they&apos;re okay
              being listed</strong> — this is their personal data, provided by you rather than
              by them directly, and it is only ever used to reach them in an emergency.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-zinc-900">Retention</h2>
            <p>
              Next-of-kin details and any contact information (including your email address) are
              deleted {event.retentionDays} days after the event — long enough to cover a late
              issue report, no longer than that. Other registration details (name and similar)
              are kept only as an internal headcount record.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-zinc-900">Your rights</h2>
            <p>
              Under the Data Protection Act 2019, you can ask to see, correct, or have your data
              deleted before the retention window above. Contact the data controller above to
              exercise these rights.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
