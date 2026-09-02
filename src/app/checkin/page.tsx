"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import { matchScannedId, type CachedAttendee } from "@/lib/checkin-match";

const UNLOCKED_KEY = "checkin-unlocked";
const ATTENDEES_KEY = "checkin-attendees";
const PENDING_SYNCS_KEY = "checkin-pending-syncs";

type PendingSync = { registrationId: string; checkedInAt: number };
type Banner = { kind: "success" | "warning" | "error"; text: string } | null;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function CheckinPage() {
  // Lazy initializers, not an effect — localStorage doesn't exist during Next's server render
  // (readJson no-ops there), but by first client render (no SSR content depends on this) it
  // does, so there's no hydration mismatch to worry about and no extra render/effect needed.
  // Only a boolean "was this device unlocked" flag lives in localStorage — the actual credential
  // is a short-lived, httpOnly session cookie the browser sends automatically, never something
  // client JS can read or that lingers indefinitely.
  const [unlocked, setUnlocked] = useState<boolean>(
    () => typeof window !== "undefined" && localStorage.getItem(UNLOCKED_KEY) === "1",
  );
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [attendees, setAttendees] = useState<CachedAttendee[]>(() =>
    readJson<CachedAttendee[]>(ATTENDEES_KEY, []),
  );
  const [pendingSyncs, setPendingSyncs] = useState<PendingSync[]>(() =>
    readJson<PendingSync[]>(PENDING_SYNCS_KEY, []),
  );
  const [banner, setBanner] = useState<Banner>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);

  const stateRef = useRef({ unlocked, attendees, pendingSyncs });
  useEffect(() => {
    stateRef.current = { unlocked, attendees, pendingSyncs };
  }, [unlocked, attendees, pendingSyncs]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw-checkin.js", { scope: "/checkin" }).catch(() => {});
    }
  }, []);

  const flushPendingSyncs = useCallback(async () => {
    const { unlocked: isUnlocked, pendingSyncs: current } = stateRef.current;
    if (!isUnlocked || current.length === 0) return;

    const stillPending: PendingSync[] = [];
    for (const item of current) {
      try {
        const res = await fetch("/api/checkin/mark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registrationId: item.registrationId }),
        });
        if (!res.ok) stillPending.push(item);
      } catch {
        stillPending.push(item);
      }
    }
    setPendingSyncs(stillPending);
    localStorage.setItem(PENDING_SYNCS_KEY, JSON.stringify(stillPending));
  }, []);

  useEffect(() => {
    flushPendingSyncs();
    window.addEventListener("online", flushPendingSyncs);
    return () => window.removeEventListener("online", flushPendingSyncs);
  }, [flushPendingSyncs]);

  async function submitPin(event: React.FormEvent) {
    event.preventDefault();
    setVerifying(true);
    setPinError(null);
    try {
      const res = await fetch("/api/checkin/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      });
      if (!res.ok) {
        setPinError(
          res.status === 429 ? "Too many attempts — wait a few minutes and try again." : "Wrong PIN.",
        );
        return;
      }
      const data = await res.json();
      localStorage.setItem(UNLOCKED_KEY, "1");
      localStorage.setItem(ATTENDEES_KEY, JSON.stringify(data.attendees));
      setUnlocked(true);
      setAttendees(data.attendees);
    } catch {
      setPinError("Couldn't reach the server — you need connectivity the first time you load this page.");
    } finally {
      setVerifying(false);
    }
  }

  async function refreshList() {
    if (!unlocked) return;
    try {
      // No PIN in the body — the session cookie set by submitPin carries auth from here on.
      const res = await fetch("/api/checkin/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) return;
      const data = await res.json();
      const pendingIds = new Set(pendingSyncs.map((p) => p.registrationId));
      const merged: CachedAttendee[] = data.attendees.map((a: CachedAttendee) =>
        pendingIds.has(a.id) ? { ...a, checkedIn: true } : a,
      );
      setAttendees(merged);
      localStorage.setItem(ATTENDEES_KEY, JSON.stringify(merged));
    } catch {
      // Offline — the cached list stands.
    }
  }

  async function lockDevice() {
    try {
      await fetch("/api/checkin/lock", { method: "POST" });
    } catch {
      // Best-effort — clearing local state below still stops this device from acting as
      // unlocked even if the network call to also clear the server-side cookie fails.
    }
    localStorage.removeItem(UNLOCKED_KEY);
    localStorage.removeItem(ATTENDEES_KEY);
    setAttendees([]);
    setUnlocked(false);
  }

  const handleScan = useCallback(
    (decodedText: string) => {
      const { attendees: current } = stateRef.current;
      const result = matchScannedId(decodedText, current);

      if (result.status === "not-found") {
        setBanner({ kind: "error", text: "Not on the list." });
        return;
      }
      if (result.status === "already-checked-in") {
        setBanner({ kind: "warning", text: `${result.attendee.name} is already checked in.` });
        return;
      }

      const updated = current.map((a) => (a.id === result.attendee.id ? { ...a, checkedIn: true } : a));
      setAttendees(updated);
      localStorage.setItem(ATTENDEES_KEY, JSON.stringify(updated));

      const pending = [
        ...stateRef.current.pendingSyncs,
        { registrationId: result.attendee.id, checkedInAt: Date.now() },
      ];
      setPendingSyncs(pending);
      localStorage.setItem(PENDING_SYNCS_KEY, JSON.stringify(pending));

      setBanner({ kind: "success", text: `${result.attendee.name} checked in.` });
      flushPendingSyncs();
    },
    [flushPendingSyncs],
  );

  const handleScanRef = useRef(handleScan);
  useEffect(() => {
    handleScanRef.current = handleScan;
  }, [handleScan]);

  useEffect(() => {
    if (!unlocked) return;

    let scanner: import("html5-qrcode").Html5QrcodeScanner | undefined;
    let cancelled = false;

    import("html5-qrcode").then(({ Html5QrcodeScanner }) => {
      if (cancelled) return;
      scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250 }, false);
      scanner.render(
        (decodedText) => handleScanRef.current(decodedText),
        () => {},
      );
    });

    return () => {
      cancelled = true;
      scanner?.clear().catch(() => setScannerError("Camera failed to start."));
    };
  }, [unlocked]);

  if (!unlocked) {
    return (
      <div className="flex flex-1 flex-col items-center bg-white px-4 py-12">
        <main className="w-full max-w-sm">
          <Breadcrumb data-testid="checkin-breadcrumb" items={[{ label: "Register", href: "/" }, { label: "Check-in" }]} />
          <h1 className="text-2xl font-semibold text-zinc-900">Organiser check-in</h1>
          <form onSubmit={submitPin} className="mt-6 flex flex-col gap-3">
            <input
              data-testid="checkin-pin-input"
              type="password"
              inputMode="numeric"
              placeholder="PIN"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none"
            />
            {pinError && (
              <p data-testid="checkin-pin-error" className="text-xs text-red-600">
                {pinError}
              </p>
            )}
            <button
              data-testid="checkin-pin-submit"
              type="submit"
              disabled={verifying}
              className="rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background disabled:opacity-50"
            >
              {verifying ? "Checking…" : "Unlock"}
            </button>
          </form>
        </main>
      </div>
    );
  }

  const checkedInCount = attendees.filter((a) => a.checkedIn).length;

  return (
    <div className="flex flex-1 flex-col items-center bg-white px-4 py-8">
      <main className="w-full max-w-sm">
        <Breadcrumb data-testid="checkin-breadcrumb" items={[{ label: "Register", href: "/" }, { label: "Check-in" }]} />
        <h1 className="text-xl font-semibold text-zinc-900">Organiser check-in</h1>
        <p data-testid="checkin-summary" className="mt-1 text-sm text-zinc-600">
          {checkedInCount} of {attendees.length} checked in
          {pendingSyncs.length > 0 && ` · ${pendingSyncs.length} pending sync`}
        </p>

        {banner && (
          <div
            data-testid="checkin-banner"
            className={`mt-4 rounded-md border px-4 py-3 text-sm ${
              banner.kind === "success"
                ? "border-green-200 bg-green-50 text-green-900"
                : banner.kind === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-red-200 bg-red-50 text-red-900"
            }`}
          >
            {banner.text}
          </div>
        )}

        <div id="qr-reader" className="mt-4" />
        {scannerError && <p className="mt-2 text-xs text-red-600">{scannerError}</p>}

        <div className="mt-4 flex gap-2">
          <button
            data-testid="checkin-refresh"
            onClick={refreshList}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Refresh list
          </button>
          <button
            data-testid="checkin-lock"
            onClick={lockDevice}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Lock
          </button>
        </div>
      </main>
    </div>
  );
}
