// Renders one event-config'd sentence (e.g. "An ACR event, in partnership with Jointea") —
// ported and generalized from busherian-hike's PartnershipBanner.tsx (issue #9), which
// hardcoded the sentence as a literal string. Only rendered by page.tsx when
// `config.landing.partnershipSentence` is set — an event with no partners simply omits it.
export default function PartnershipBanner({ sentence }: { sentence: string }) {
  return (
    <p
      data-testid="partnership-banner"
      className="mt-10 border-t border-zinc-200 pt-6 text-center text-lg text-zinc-700 italic"
    >
      {sentence}
    </p>
  );
}
