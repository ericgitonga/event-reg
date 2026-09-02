"use client";

import { useState, type FormEvent } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import type { PaymentListRow } from "@/lib/registrations-store";

function formatCustomFields(fields: Record<string, unknown>): string {
  return Object.entries(fields)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
}

export default function PaymentsPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [registrations, setRegistrations] = useState<PaymentListRow[]>([]);
  const [search, setSearch] = useState("");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPin, setExportPin] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function submitPin(event: FormEvent) {
    event.preventDefault();
    setVerifying(true);
    setPinError(null);
    try {
      const res = await fetch("/api/payments/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      });
      if (!res.ok) {
        setPinError(res.status === 429 ? "Too many attempts — wait a few minutes and try again." : "Wrong PIN.");
        return;
      }
      const data = await res.json();
      setUnlocked(true);
      setRegistrations(data.registrations);
    } catch {
      setPinError("Couldn't reach the server.");
    } finally {
      setVerifying(false);
    }
  }

  async function refreshList() {
    try {
      const res = await fetch("/api/payments/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) return;
      const data = await res.json();
      setRegistrations(data.registrations);
    } catch {
      // Best-effort — the on-screen list stands.
    }
  }

  async function lockDevice() {
    try {
      await fetch("/api/payments/lock", { method: "POST" });
    } catch {
      // Best-effort — clearing local state below still stops this device from acting as
      // unlocked even if the network call to also clear the server-side cookie fails.
    }
    setRegistrations([]);
    setUnlocked(false);
  }

  async function submitExport(event: FormEvent) {
    event.preventDefault();
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/export/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: exportPin }),
      });
      if (!res.ok) {
        setExportError(res.status === 429 ? "Too many attempts — wait a few minutes and try again." : "Wrong PIN.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `registrations-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setExportOpen(false);
      setExportPin("");
    } catch {
      setExportError("Couldn't reach the server.");
    } finally {
      setExporting(false);
    }
  }

  async function markPaid(registrationId: string) {
    setMarkingId(registrationId);
    try {
      const res = await fetch("/api/payments/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId }),
      });
      if (res.ok) {
        setRegistrations((prev) => prev.map((r) => (r.id === registrationId ? { ...r, paid: true } : r)));
      }
    } finally {
      setMarkingId(null);
    }
  }

  async function resendSms(registrationId: string) {
    setResendingId(registrationId);
    try {
      const res = await fetch("/api/payments/resend-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId }),
      });
      const data = res.ok ? await res.json() : null;
      const smsStatus = data?.status === "sent" || data?.status === "failed" ? data.status : null;
      if (smsStatus) {
        setRegistrations((prev) => prev.map((r) => (r.id === registrationId ? { ...r, smsStatus } : r)));
      }
    } finally {
      setResendingId(null);
    }
  }

  async function deleteRegistration(registrationId: string) {
    setDeletingId(registrationId);
    try {
      const res = await fetch("/api/payments/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId }),
      });
      if (res.ok) {
        setRegistrations((prev) => prev.filter((r) => r.id !== registrationId));
      }
    } finally {
      setDeletingId(null);
      setConfirmingDeleteId(null);
    }
  }

  if (!unlocked) {
    return (
      <div className="flex flex-1 flex-col items-center bg-white px-4 py-12">
        <main className="w-full max-w-sm">
          <Breadcrumb data-testid="payments-breadcrumb" items={[{ label: "Register", href: "/" }, { label: "Payments" }]} />
          <h1 className="text-2xl font-semibold text-zinc-900">Mark payments</h1>
          <form onSubmit={submitPin} className="mt-6 flex flex-col gap-3">
            <input
              data-testid="payments-pin-input"
              type="password"
              inputMode="numeric"
              placeholder="PIN"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none"
            />
            {pinError && (
              <p data-testid="payments-pin-error" className="text-xs text-red-600">
                {pinError}
              </p>
            )}
            <button
              data-testid="payments-pin-submit"
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

  const filtered = registrations.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="flex flex-1 flex-col items-center bg-white px-4 py-8">
      <main className="w-full max-w-lg">
        <Breadcrumb data-testid="payments-breadcrumb" items={[{ label: "Register", href: "/" }, { label: "Payments" }]} />
        <h1 className="text-xl font-semibold text-zinc-900">Mark payments</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Marking someone paid also covers every guest they registered — it decrements the public
          slots-remaining counter by (1 + their guest count) and makes them eligible for check-in.
        </p>

        <input
          data-testid="payments-search"
          type="text"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-4 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none"
        />

        <div className="mt-4 flex gap-2">
          <button
            data-testid="payments-refresh"
            onClick={refreshList}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Refresh list
          </button>
          <button
            data-testid="payments-lock"
            onClick={lockDevice}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Lock
          </button>
          <button
            data-testid="payments-export-toggle"
            onClick={() => {
              setExportOpen((open) => !open);
              setExportError(null);
            }}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Export CSV
          </button>
        </div>

        {exportOpen && (
          <form onSubmit={submitExport} className="mt-3 flex flex-col gap-2 rounded-md border border-zinc-200 p-3">
            <p className="text-xs text-zinc-600">
              Downloads the full dataset, including next-of-kin numbers — re-enter the PIN to confirm.
            </p>
            <input
              data-testid="payments-export-pin-input"
              type="password"
              inputMode="numeric"
              placeholder="PIN"
              value={exportPin}
              onChange={(e) => setExportPin(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none"
            />
            {exportError && (
              <p data-testid="payments-export-pin-error" className="text-xs text-red-600">
                {exportError}
              </p>
            )}
            <button
              data-testid="payments-export-submit"
              type="submit"
              disabled={exporting}
              className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {exporting ? "Downloading…" : "Download CSV"}
            </button>
          </form>
        )}

        <ul className="mt-4 flex flex-col gap-2">
          {filtered.map((row) => (
            <li
              key={row.id}
              data-testid="payment-row"
              className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 text-sm"
            >
              <div>
                <p data-testid="payment-row-name" className="font-medium text-zinc-900">
                  {row.name}
                  {row.guestCount > 0 && ` + ${row.guestCount} guest${row.guestCount === 1 ? "" : "s"}`}
                </p>
                <p className="text-xs text-zinc-500">
                  {formatCustomFields(row.customFields)}
                  {row.mpesaCode && ` · proof submitted: ${row.mpesaCode} from ${row.payerPhone}`}
                  {row.smsStatus === "failed" && (
                    <span data-testid="payment-row-sms-failed" className="ml-1 text-red-600">
                      · confirmation SMS failed
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {row.payerPhone && (
                  <button
                    data-testid="payment-row-resend-sms"
                    onClick={() => resendSms(row.id)}
                    disabled={resendingId === row.id}
                    className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {resendingId === row.id ? "Resending…" : "Resend SMS"}
                  </button>
                )}
                {row.paid ? (
                  <span
                    data-testid="payment-row-paid-badge"
                    className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800"
                  >
                    Paid
                  </span>
                ) : (
                  <button
                    data-testid="payment-row-mark-paid"
                    onClick={() => markPaid(row.id)}
                    disabled={markingId === row.id}
                    className="rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background disabled:opacity-50"
                  >
                    {markingId === row.id ? "Marking…" : "Mark paid"}
                  </button>
                )}
                {confirmingDeleteId === row.id ? (
                  <>
                    <button
                      data-testid="payment-row-delete-confirm"
                      onClick={() => deleteRegistration(row.id)}
                      disabled={deletingId === row.id}
                      className="rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                    >
                      {deletingId === row.id ? "Deleting…" : "Confirm delete"}
                    </button>
                    <button
                      data-testid="payment-row-delete-cancel"
                      onClick={() => setConfirmingDeleteId(null)}
                      disabled={deletingId === row.id}
                      className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    data-testid="payment-row-delete"
                    onClick={() => setConfirmingDeleteId(row.id)}
                    className="rounded-full border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
