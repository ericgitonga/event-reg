export default function SlotsRemaining({
  remaining,
  cap,
}: {
  remaining: number;
  cap: number;
}) {
  return (
    <p
      data-testid="slots-remaining"
      className="mt-2 text-sm font-medium text-zinc-700"
    >
      {remaining <= 0
        ? "Fully booked — no slots remaining"
        : `${remaining} of ${cap} slots remaining`}
    </p>
  );
}
