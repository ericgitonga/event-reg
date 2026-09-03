"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { completeRegistration, validateRegistration } from "@/app/actions";
import type { EventFieldDefinition } from "@/lib/event-fields";
import { MEDIA_CONSENT_VALUES, type RegistrationFieldErrors } from "@/lib/registration";
import { totalFee } from "@/lib/payment";
import { MpesaManualConfigSchema } from "@/lib/payment-providers";

type Props = {
  customFields: EventFieldDefinition[];
  perHeadFee: number;
  currency: string;
  paymentProvider: string;
  paymentConfig: Record<string, unknown>;
  isTestEnvironment: boolean;
};

const initialBaseValues = {
  name: "",
  guestCount: "0",
  nextOfKinName: "",
  nextOfKinContact: "",
  email: "",
  termsAccepted: false,
  mediaConsent: "" as "" | (typeof MEDIA_CONSENT_VALUES)[number],
  isTestRow: false,
};

type BaseFieldName = keyof typeof initialBaseValues;
type CustomValues = Record<string, string | boolean>;

const initialProofValues = { payerPhone: "", mpesaCode: "" };
type ProofFieldName = keyof typeof initialProofValues;

function initialCustomValues(fields: EventFieldDefinition[]): CustomValues {
  const values: CustomValues = {};
  for (const field of fields) {
    values[field.key] = field.type === "checkbox" ? false : "";
  }
  return values;
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-900">
      {label}
      {children}
      {error && (
        <span className="text-xs font-normal text-red-600" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-normal text-zinc-900 focus:border-zinc-500 focus:outline-none";

function CustomFieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: EventFieldDefinition;
  value: string | boolean;
  error?: string;
  onChange: (value: string | boolean) => void;
}) {
  const testId = `field-${field.key}`;
  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm font-medium text-zinc-900">
        <input
          data-testid={testId}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        {field.label}
      </label>
    );
  }
  if (field.type === "select") {
    return (
      <Field label={field.label} error={error}>
        <select
          data-testid={testId}
          className={inputClass}
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select…</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </Field>
    );
  }
  return (
    <Field label={field.label} error={error}>
      <input
        data-testid={testId}
        className={inputClass}
        inputMode={field.type === "number" ? "numeric" : undefined}
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export default function RegistrationForm({
  customFields,
  perHeadFee,
  currency,
  paymentProvider,
  paymentConfig,
  isTestEnvironment,
}: Props) {
  const [values, setValues] = useState(initialBaseValues);
  const [custom, setCustom] = useState<CustomValues>(() => initialCustomValues(customFields));
  const [errors, setErrors] = useState<RegistrationFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [full, setFull] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [done, setDone] = useState(false);

  const [proof, setProof] = useState(initialProofValues);
  const [proofErrors, setProofErrors] = useState<Record<string, string>>({});
  const [proofSubmitting, setProofSubmitting] = useState(false);
  const [proofRateLimited, setProofRateLimited] = useState(false);
  const [genericError, setGenericError] = useState(false);

  function update<K extends BaseFieldName>(field: K, value: (typeof initialBaseValues)[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function updateCustom(key: string, value: string | boolean) {
    setCustom((prev) => ({ ...prev, [key]: value }));
  }

  function updateProof(field: ProofFieldName, value: string) {
    setProof((prev) => ({ ...prev, [field]: value }));
  }

  // Validation-only — writes nothing to the database. Opening the payment step on success is
  // purely a client-side transition; the row this registration will eventually become doesn't
  // exist until handleProofSubmit's completeRegistration call below actually succeeds.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});

    const result = await validateRegistration({ ...values, custom });

    setSubmitting(false);

    if (!result.success) {
      if (result.reason === "full") setFull(true);
      else if (result.reason === "rate_limited") setRateLimited(true);
      else setErrors(result.errors);
      return;
    }

    setSubmitted(true);
  }

  // The only place a write happens — completeRegistration validates and inserts the main form's
  // fields together with the payment proof in one call.
  async function handleProofSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setProofSubmitting(true);
    setProofErrors({});
    setGenericError(false);

    const result = await completeRegistration({ ...values, custom, proof });

    setProofSubmitting(false);

    if (!result.success) {
      if (result.reason === "rate_limited") {
        setProofRateLimited(true);
      } else if (result.reason === "validation") {
        // Splits the combined error object between the payment step's own fields ("proof.*")
        // and the main form's — a proof error is the expected case and stays in the payment
        // step; a main-field error here means validateRegistration's earlier pass and this one
        // disagreed (a race or tampered request, not normal use), so the payment step closes and
        // the main form re-opens to show it.
        const proofFieldErrors: Record<string, string> = {};
        const mainFieldErrors: RegistrationFieldErrors = {};
        for (const [key, message] of Object.entries(result.errors)) {
          if (key.startsWith("proof.")) {
            proofFieldErrors[key.slice("proof.".length)] = message;
          } else {
            mainFieldErrors[key] = message;
          }
        }
        setProofErrors(proofFieldErrors);
        if (Object.keys(mainFieldErrors).length > 0) {
          setErrors(mainFieldErrors);
          setSubmitted(false);
        }
      } else if (result.reason === "full") {
        setSubmitted(false);
        setFull(true);
      } else {
        setGenericError(true);
      }
      return;
    }

    setDone(true);
  }

  // Nothing has been written yet at this point, so cancelling is just a client-side reset — no
  // server round-trip needed. The main form's already-typed values are deliberately left in
  // place.
  function handleCancel() {
    setSubmitted(false);
    setProof(initialProofValues);
    setProofErrors({});
    setProofRateLimited(false);
    setGenericError(false);
  }

  if (full) {
    return (
      <div
        data-testid="registration-full"
        className="rounded-md border border-amber-200 bg-amber-50 px-4 py-6 text-center text-amber-900"
      >
        <p className="font-semibold">Sorry, we&apos;re fully booked.</p>
        <p className="mt-1 text-sm">All slots for this event have been claimed.</p>
      </div>
    );
  }

  if (rateLimited) {
    return (
      <div
        data-testid="registration-rate-limited"
        className="rounded-md border border-amber-200 bg-amber-50 px-4 py-6 text-center text-amber-900"
      >
        <p className="font-semibold">Too many attempts.</p>
        <p className="mt-1 text-sm">Please wait a bit and try again.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div
        data-testid="registration-done"
        className="rounded-md border border-green-200 bg-green-50 px-4 py-6 text-center text-green-900"
      >
        <p className="font-semibold">Thanks — you&apos;re all set!</p>
      </div>
    );
  }

  const guestCount = Number(values.guestCount) || 0;
  const fee = totalFee(perHeadFee, guestCount);

  return (
    <>
      <form
        data-testid="registration-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        {/* display: contents keeps the parent's flex/gap layout — locking the fields via a
            fieldset shouldn't introduce an extra box. */}
        <fieldset disabled={submitted} className="contents">
          <Field label="Full name" error={errors.name}>
            <input
              data-testid="field-name"
              className={inputClass}
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </Field>

          <Field label="Number of guests" error={errors.guestCount}>
            <input
              data-testid="field-guestCount"
              className={inputClass}
              inputMode="numeric"
              value={values.guestCount}
              onChange={(e) => update("guestCount", e.target.value)}
            />
          </Field>

          <Field label="Next-of-kin name" error={errors.nextOfKinName}>
            <input
              data-testid="field-nextOfKinName"
              className={inputClass}
              value={values.nextOfKinName}
              onChange={(e) => update("nextOfKinName", e.target.value)}
            />
          </Field>

          <Field label="Next-of-kin contact" error={errors.nextOfKinContact}>
            <input
              data-testid="field-nextOfKinContact"
              className={inputClass}
              placeholder="0712345678"
              value={values.nextOfKinContact}
              onChange={(e) => update("nextOfKinContact", e.target.value)}
            />
          </Field>
          <p data-testid="next-of-kin-hint" className="-mt-2 text-xs text-zinc-500">
            Emergency contact only — please confirm they&apos;re okay being listed. See our{" "}
            <Link href="/privacy" data-testid="next-of-kin-privacy-link" className="underline hover:text-zinc-700">
              Privacy Notice
            </Link>
            .
          </p>

          {customFields.map((field) => (
            <CustomFieldInput
              key={field.key}
              field={field}
              value={custom[field.key]}
              error={errors[`custom.${field.key}`]}
              onChange={(value) => updateCustom(field.key, value)}
            />
          ))}

          <Field label="Email (optional)" error={errors.email}>
            <input
              data-testid="field-email"
              className={inputClass}
              type="email"
              value={values.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </Field>

          <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4">
            <h2 className="text-sm font-semibold text-zinc-900">Acknowledgement and Declaration</h2>
            <label className="flex items-start gap-2 text-sm font-normal text-zinc-900">
              <input
                data-testid="field-termsAccepted"
                type="checkbox"
                className="mt-0.5"
                checked={values.termsAccepted}
                onChange={(e) => update("termsAccepted", e.target.checked)}
              />
              <span>
                I have read and agree to the{" "}
                <Link href="/terms" target="_blank" className="underline hover:text-zinc-700">
                  Terms and Conditions
                </Link>
                .
              </span>
            </label>
            {errors.termsAccepted && (
              <span className="text-xs font-normal text-red-600" role="alert">
                {errors.termsAccepted}
              </span>
            )}
          </div>

          <fieldset
            data-testid="field-mediaConsent"
            className="flex flex-col gap-1 text-sm font-medium text-zinc-900"
          >
            <legend className="mb-1">Photograph and Media Consent</legend>
            <p className="mb-1 text-xs font-normal text-zinc-500">
              Please select one. Declining does not prevent you from taking part.
            </p>
            <label className="flex items-start gap-2 font-normal">
              <input
                data-testid="media-consent-yes"
                type="radio"
                name="mediaConsent"
                value="yes"
                className="mt-0.5"
                checked={values.mediaConsent === "yes"}
                onChange={() => update("mediaConsent", "yes")}
              />
              <span>Yes — I consent to photo/video use for promotional purposes.</span>
            </label>
            <label className="flex items-start gap-2 font-normal">
              <input
                data-testid="media-consent-no"
                type="radio"
                name="mediaConsent"
                value="no"
                className="mt-0.5"
                checked={values.mediaConsent === "no"}
                onChange={() => update("mediaConsent", "no")}
              />
              <span>No — I do not consent to photo/video use.</span>
            </label>
            {errors.mediaConsent && (
              <span className="text-xs font-normal text-red-600" role="alert">
                {errors.mediaConsent}
              </span>
            )}
          </fieldset>

          {isTestEnvironment && (
            <label className="flex items-center gap-2 text-sm font-medium text-amber-700">
              <input
                data-testid="field-isTestRow"
                type="checkbox"
                checked={values.isTestRow}
                onChange={(e) => update("isTestRow", e.target.checked)}
              />
              This is a test registration (not a real signup)
            </label>
          )}

          <button
            data-testid="submit-registration"
            type="submit"
            disabled={submitting || submitted}
            className="mt-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50"
          >
            {submitted ? "Registered" : submitting ? "Submitting…" : "Register"}
          </button>
        </fieldset>
      </form>

      {submitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
          <div
            data-testid="registration-success"
            role="dialog"
            aria-modal="true"
            aria-label="Complete your payment"
            className="max-h-full w-full max-w-md overflow-y-auto rounded-md border border-green-200 bg-green-50 px-4 py-6 text-center text-green-900 shadow-xl"
          >
            <p className="font-semibold">You&apos;re registered!</p>

            {paymentProvider === "mpesa_manual" ? (
              <MpesaManualStep
                fee={fee}
                currency={currency}
                guestCount={guestCount}
                paymentConfig={paymentConfig}
                proof={proof}
                proofErrors={proofErrors}
                proofRateLimited={proofRateLimited}
                genericError={genericError}
                proofSubmitting={proofSubmitting}
                onChange={updateProof}
                onSubmit={handleProofSubmit}
              />
            ) : (
              <p className="mt-1 text-sm">
                This event&apos;s payment provider (&quot;{paymentProvider}&quot;) isn&apos;t supported yet.
              </p>
            )}

            <button
              data-testid="cancel-registration"
              type="button"
              onClick={handleCancel}
              className="mt-3 text-xs font-medium text-green-900 underline hover:text-green-700"
            >
              Changed your mind? Cancel registration
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function MpesaManualStep({
  fee,
  currency,
  guestCount,
  paymentConfig,
  proof,
  proofErrors,
  proofRateLimited,
  genericError,
  proofSubmitting,
  onChange,
  onSubmit,
}: {
  fee: number;
  currency: string;
  guestCount: number;
  paymentConfig: Record<string, unknown>;
  proof: typeof initialProofValues;
  proofErrors: Record<string, string>;
  proofRateLimited: boolean;
  genericError: boolean;
  proofSubmitting: boolean;
  onChange: (field: ProofFieldName, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  // safeParse, not parse (issue #33, Informational I3): paymentConfig is operator-set
  // (payment_config_json), not attacker-reachable, but a single malformed field would otherwise
  // throw inside this render and take down the entire public registration page for every
  // visitor, with no graceful fallback — an availability risk from a simple config typo.
  const result = MpesaManualConfigSchema.safeParse(paymentConfig);
  if (!result.success) {
    return (
      <p className="mt-1 text-sm text-red-700">
        Payment isn&apos;t configured correctly for this event — please contact the organiser
        directly to complete your registration.
      </p>
    );
  }
  const config = result.data;
  return (
    <>
      <p className="mt-1 text-sm">
        Send {currency} {fee} via M-Pesa to {config.recipientPhone} ({config.recipientName}) to confirm your spot
        {guestCount > 0 ? ` for you and ${guestCount} guest${guestCount === 1 ? "" : "s"}` : ""}.
      </p>

      <form
        data-testid="mpesa-payment-form"
        onSubmit={onSubmit}
        className="mt-4 flex flex-col gap-3 text-left"
        noValidate
      >
        <p className="text-xs font-medium text-green-900">
          Already sent it? Enter the number you paid from and the M-Pesa transaction code from the confirmation SMS.
        </p>
        <Field label="Your M-Pesa phone number" error={proofErrors.payerPhone}>
          <input
            data-testid="field-payerPhone"
            className={inputClass}
            placeholder="0712345678"
            value={proof.payerPhone}
            onChange={(e) => onChange("payerPhone", e.target.value)}
          />
        </Field>
        <Field label="M-Pesa transaction code" error={proofErrors.mpesaCode}>
          <input
            data-testid="field-mpesaCode"
            className={inputClass}
            value={proof.mpesaCode}
            onChange={(e) => onChange("mpesaCode", e.target.value)}
          />
        </Field>
        {proofRateLimited && (
          <p data-testid="mpesa-rate-limited" className="text-xs font-normal text-red-600" role="alert">
            Too many attempts. Please wait a bit and try again.
          </p>
        )}
        {genericError && (
          <p className="text-xs font-normal text-red-600" role="alert">
            Something went wrong — please try again, or contact the organiser directly.
          </p>
        )}
        <button
          data-testid="submit-mpesa-payment"
          type="submit"
          disabled={proofSubmitting}
          className="rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50"
        >
          {proofSubmitting ? "Submitting…" : "Submit payment proof"}
        </button>
      </form>
    </>
  );
}
