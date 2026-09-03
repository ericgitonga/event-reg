import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";
import { getActiveEvent } from "@/lib/events-store";
import { parseLegalConfig } from "@/lib/legal-config";

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
  return { title: `Terms and Conditions — ${event.name}` };
}

// Reproduces busherian-hike's terms/page.tsx (sections 1-18 of `extras/clients/busherians/
// Participant Waiver and Data Protection Notice.pdf`) as a narrowly-templated page: the prose
// structure is fixed, and only the volatile fields — entity/organiser name+email
// (`config.legal`, src/lib/legal-config.ts), event name/date/venue, and the DPA contact
// (the active event's own columns) — are interpolated, per generalize.md §5's recommendation.
// Revisit only if a future event's waiver genuinely doesn't fit this template.
export default async function TermsPage() {
  const event = await getActiveEvent();
  const legal = parseLegalConfig(event.config);
  const dateAndVenue = [formatEventDate(event.eventDate), event.venue].filter(Boolean).join(" — ");

  return (
    <div className="flex flex-1 flex-col items-center bg-white px-4 py-12">
      <main className="w-full max-w-lg">
        <Breadcrumb
          data-testid="terms-breadcrumb"
          items={[{ label: "Register", href: "/" }, { label: "Terms and Conditions" }]}
        />
        <h1 className="text-2xl font-semibold text-zinc-900">
          Terms and Conditions, Participant Waiver and Data Protection Notice
        </h1>

        <div
          data-testid="terms-content"
          className="mt-6 flex flex-col gap-5 text-sm leading-6 text-zinc-700"
        >
          <section>
            <p className="font-semibold text-zinc-900">FOR {legal.entityName}</p>
            <p>
              <strong>Organiser:</strong> {legal.organiserName}
              <br />
              <strong>Email:</strong> {legal.organiserEmail}
            </p>
            <p>
              <strong>Activity/Event:</strong> {event.name}
              <br />
              <strong>Date and venue:</strong> {dateAndVenue}
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-zinc-900">1. Acceptance of these terms</h2>
            <p>
              By registering for, attending or participating in the Activity, I confirm that I
              have read, understood and agree to be bound by these Terms and Conditions.
            </p>
            <p className="mt-2">
              I understand that participation in sporting and outdoor activities involves
              inherent risks, including the possibility of injury, illness, loss of property,
              disability or, in exceptional circumstances, death.
            </p>
            <p className="mt-2">
              I voluntarily choose to participate in the Activity and agree to comply with all
              reasonable instructions, safety requirements and rules issued by the Organiser,
              instructors, guides, officials, referees, medical personnel and venue operators.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-zinc-900">
              2. Nature of the activity and inherent risks
            </h2>
            <p>
              I acknowledge that outdoor and sporting activities may involve risks arising from,
              among other things:
            </p>
            <ul className="mt-1 list-inside list-disc">
              <li>falls, slips, trips and collisions;</li>
              <li>uneven, slippery, steep or unstable terrain;</li>
              <li>weather conditions, including rain, heat, cold, lightning and strong winds;</li>
              <li>water, rivers, swimming pools or other bodies of water, where applicable;</li>
              <li>interaction with animals, insects, plants or other natural hazards;</li>
              <li>equipment failure or improper use of equipment;</li>
              <li>actions or negligence of other participants;</li>
              <li>road traffic or interaction with vehicles, where applicable;</li>
              <li>physical exertion, fatigue, dehydration or exhaustion;</li>
              <li>pre-existing or undisclosed medical conditions;</li>
              <li>accidents occurring during transportation associated with the Activity; and</li>
              <li>other risks reasonably associated with the particular Activity.</li>
            </ul>
            <p className="mt-2">
              I voluntarily assume these inherent risks to the extent permitted by applicable
              law.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-zinc-900">3. Fitness and medical condition</h2>
            <p>I confirm that I am physically and mentally capable of participating in the Activity.</p>
            <p className="mt-2">
              I agree to inform the Organiser before participation of any medical condition,
              allergy, injury, medication, disability or other circumstance that may reasonably
              affect my ability to participate safely.
            </p>
            <p className="mt-2">
              I understand that the Organiser may, where reasonably necessary for my safety or
              the safety of others, refuse or discontinue my participation.
            </p>
            <p className="mt-2">
              I acknowledge that I am responsible for obtaining appropriate medical advice before
              participating if I have any concerns regarding my fitness or ability to
              participate.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-zinc-900">4. Safety requirements</h2>
            <p>I agree to:</p>
            <ul className="mt-1 list-inside list-disc">
              <li>follow all safety instructions;</li>
              <li>use protective equipment where required;</li>
              <li>remain within designated activity areas;</li>
              <li>comply with instructions from guides, coaches, officials and event personnel;</li>
              <li>not participate while under the influence of alcohol or illegal drugs;</li>
              <li>immediately report any injury, illness, unsafe condition or equipment defect; and</li>
              <li>behave responsibly and avoid conduct that could endanger myself or another participant.</li>
            </ul>
            <p className="mt-2">
              The Organiser reserves the right to remove a participant from the Activity where
              the participant&apos;s conduct creates a safety risk.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-zinc-900">
              5. Accidents, injury and emergency medical treatment
            </h2>
            <p>I acknowledge that accidents and injuries may occur despite reasonable precautions.</p>
            <p className="mt-2">
              In the event of an accident, injury or medical emergency, I authorise the Organiser
              and/or its appointed personnel, where reasonably necessary, to arrange or facilitate
              first aid, emergency assistance, transportation to a medical facility and/or other
              appropriate emergency measures.
            </p>
            <p className="mt-2">
              I understand that the Organiser is not a medical service provider and does not
              guarantee the availability or outcome of medical treatment.
            </p>
            <p className="mt-2">
              I am responsible for my own medical, hospital, ambulance, evacuation and related
              expenses unless expressly stated otherwise by the Organiser.
            </p>
            <p className="mt-2">
              Where I have provided emergency contact information, I authorise the Organiser to
              contact the nominated emergency contact where reasonably necessary.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-zinc-900">6. Assumption of risk and liability</h2>
            <p>
              I participate voluntarily and accept responsibility for the ordinary and inherent
              risks associated with the Activity.
            </p>
            <p className="mt-2">
              To the fullest extent permitted by applicable law, I agree that the Organiser, its
              directors, employees, instructors, guides, volunteers, contractors, agents, venue
              operators and event partners shall not be liable for loss, injury, damage or
              expense arising from my participation to the extent that such loss results from
              risks that are inherent and reasonably foreseeable in the Activity.
            </p>
            <p className="mt-2">
              Nothing in these Terms excludes or limits liability to the extent that such
              exclusion or limitation is prohibited by applicable law, including liability
              arising from fraud, wilful misconduct or negligence where such liability cannot
              lawfully be excluded.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-zinc-900">7. Personal property</h2>
            <p>I am responsible for my personal belongings brought to the Activity.</p>
            <p className="mt-2">
              The Organiser shall not be responsible for loss, theft or damage to personal
              property except to the extent liability cannot lawfully be excluded.
            </p>
            <p className="mt-2">
              Participants are encouraged not to bring valuable or unnecessary personal
              belongings to the Activity.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-zinc-900">8. Equipment</h2>
            <p>Where equipment is supplied by the Organiser, I agree to:</p>
            <ul className="mt-1 list-inside list-disc">
              <li>use the equipment only for its intended purpose;</li>
              <li>follow all instructions regarding its use;</li>
              <li>immediately report damage, malfunction or defects; and</li>
              <li>return the equipment in the condition in which it was provided, subject to reasonable wear and tear.</li>
            </ul>
            <p className="mt-2">
              Where I use my own equipment, I am responsible for ensuring that it is suitable and
              safe for the Activity.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-zinc-900">9. Cancellation, weather and changes</h2>
            <p>
              The Organiser may postpone, modify, relocate or cancel the Activity where
              reasonably necessary because of:
            </p>
            <ul className="mt-1 list-inside list-disc">
              <li>severe or unsafe weather;</li>
              <li>environmental or natural hazards;</li>
              <li>government restrictions or directions;</li>
              <li>venue or equipment issues;</li>
              <li>insufficient participation;</li>
              <li>security or safety concerns; or</li>
              <li>circumstances beyond the Organiser&apos;s reasonable control.</li>
            </ul>
            <p className="mt-2">
              Where reasonably practicable, the Organiser will provide participants with notice
              of material changes.
            </p>
            <p className="mt-2">
              Any refund or transfer arrangements shall be subject to the Organiser&apos;s
              applicable cancellation policy.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-zinc-900">
              10. Photography, video and audio recording
            </h2>
            <p>
              The Organiser, its appointed photographers, videographers or authorised media
              partners may take photographs, video recordings and/or audio recordings during the
              Activity.
            </p>
            <p className="mt-2">
              Such recordings may contain identifiable images, voices or other information
              relating to participants and may therefore constitute personal data.
            </p>

            <h3 className="mt-3 font-medium text-zinc-900">10.1 Event documentation</h3>
            <p>
              I understand that the Organiser may take photographs and recordings for purposes
              including:
            </p>
            <ul className="mt-1 list-inside list-disc">
              <li>documenting the Activity;</li>
              <li>maintaining event records;</li>
              <li>demonstrating participation;</li>
              <li>internal reporting;</li>
              <li>safety and incident documentation; and</li>
              <li>producing materials relating to the Activity.</li>
            </ul>

            <h3 className="mt-3 font-medium text-zinc-900">10.2 Promotional use</h3>
            <p>
              Where I provide specific consent below, the Organiser may use photographs and/or
              recordings in which I appear for promotional and communications purposes,
              including:
            </p>
            <ul className="mt-1 list-inside list-disc">
              <li>the Organiser&apos;s website;</li>
              <li>social media platforms;</li>
              <li>brochures and promotional materials;</li>
              <li>newsletters;</li>
              <li>presentations;</li>
              <li>advertisements;</li>
              <li>event reports;</li>
              <li>press releases; and</li>
              <li>future promotional materials relating to the Organiser or similar activities.</li>
            </ul>
            <p className="mt-2">
              I understand that once material is published on social media or other publicly
              accessible platforms, it may potentially be copied, shared or republished by third
              parties outside the Organiser&apos;s control.
            </p>

            <h3 className="mt-3 font-medium text-zinc-900">10.3 No payment for use</h3>
            <p>
              Unless separately agreed in writing, I understand that I will not receive payment,
              royalties or other compensation for the permitted use of my photograph, image,
              voice or recording.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-zinc-900">11. Data protection and privacy</h2>
            <p>
              The Organiser will process personal information in accordance with applicable
              Kenyan data protection law, including the <strong>Data Protection Act, 2019</strong>{" "}
              and applicable regulations.
            </p>
            <p className="mt-2">
              The Organiser will collect and process only personal information reasonably
              required for legitimate purposes connected with the Activity.
            </p>
            <p className="mt-2">Depending on the circumstances, information collected may include:</p>
            <ul className="mt-1 list-inside list-disc">
              <li>full name;</li>
              <li>telephone number;</li>
              <li>email address;</li>
              <li>emergency contact information;</li>
              <li>age or date of birth;</li>
              <li>registration information;</li>
              <li>payment information;</li>
              <li>photographs and video recordings;</li>
              <li>participation records;</li>
              <li>location information where necessary for the Activity; and</li>
              <li>medical or health information where voluntarily provided and reasonably necessary for participant safety.</li>
            </ul>
            <p className="mt-2">
              The Data Protection Act requires personal data to be processed lawfully, fairly and
              transparently and for specified legitimate purposes.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-zinc-900">12. Purposes of processing</h2>
            <p>Personal information may be processed for the following purposes:</p>
            <ul className="mt-1 list-inside list-disc">
              <li>registering participants;</li>
              <li>administering and organising the Activity;</li>
              <li>communicating with participants;</li>
              <li>processing payments and issuing receipts;</li>
              <li>managing safety and emergencies;</li>
              <li>contacting emergency contacts where necessary;</li>
              <li>complying with legal and regulatory obligations;</li>
              <li>maintaining appropriate event records;</li>
              <li>investigating accidents or incidents;</li>
              <li>providing insurance or claims information where applicable;</li>
              <li>taking and using photographs and recordings where the appropriate permission has been provided; and</li>
              <li>other purposes communicated to the participant at or before the time of collection.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-zinc-900">13. Legal basis for processing</h2>
            <p>
              The Organiser may rely on one or more lawful bases for processing personal
              information, depending on the particular purpose, including:
            </p>
            <ul className="mt-1 list-inside list-disc">
              <li>performance of a contract or steps taken at the participant&apos;s request;</li>
              <li>compliance with a legal obligation;</li>
              <li>protection of vital interests or participant safety, where applicable;</li>
              <li>legitimate interests, where legally permissible; and</li>
              <li>consent, where consent is required or relied upon.</li>
            </ul>
            <p className="mt-2">
              Where processing is based on consent, consent will be requested for a specified
              purpose and may be withdrawn in accordance with applicable law.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-zinc-900">14. Withdrawal of media consent</h2>
            <p>Where processing is based on my consent, I may withdraw that consent by contacting:</p>
            <p>
              <strong>Data Protection Contact:</strong> {event.dataControllerName}
              <br />
              <strong>Contact:</strong> {event.dataControllerContact}
            </p>
            <p className="mt-2">
              Withdrawal of consent will not affect the lawfulness of processing carried out
              before the withdrawal.
            </p>
            <p className="mt-2">
              The Organiser will take reasonable steps to stop future use of the relevant
              material following a valid withdrawal request, subject to applicable law and
              reasonable practical limitations.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-zinc-900">15. Data retention</h2>
            <p>
              The Organiser will retain personal information only for as long as reasonably
              necessary for the purpose for which it was collected, unless a longer retention
              period is required or permitted by law.
            </p>
            <p className="mt-2">Different categories of information may therefore be retained for different periods.</p>
            <p className="mt-2">
              Photographs and promotional materials that have already been lawfully published may
              remain in historical records or archived materials, subject to applicable law and
              reasonable measures taken by the Organiser.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-zinc-900">16. Sharing of personal information</h2>
            <p>
              The Organiser may share relevant personal information with service providers and
              third parties where reasonably necessary to conduct the Activity, including:
            </p>
            <ul className="mt-1 list-inside list-disc">
              <li>event management providers;</li>
              <li>payment service providers;</li>
              <li>photographers and videographers;</li>
              <li>medical and emergency service providers;</li>
              <li>insurers;</li>
              <li>venues;</li>
              <li>technology and hosting providers;</li>
              <li>professional advisers; and</li>
              <li>government, regulatory or law-enforcement authorities where legally required.</li>
            </ul>
            <p className="mt-2">
              The Organiser will take reasonable steps to ensure that third parties processing
              personal information on its behalf provide appropriate data protection safeguards.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-zinc-900">17. Participant data protection rights</h2>
            <p>Subject to applicable law, participants may have rights including the right to:</p>
            <ul className="mt-1 list-inside list-disc">
              <li>be informed about the use of their personal information;</li>
              <li>request access to personal information held about them;</li>
              <li>request correction of inaccurate or misleading information;</li>
              <li>object to certain processing;</li>
              <li>request deletion of personal information in appropriate circumstances; and</li>
              <li>withdraw consent where processing is based on consent.</li>
            </ul>
            <p className="mt-2">
              The Office of the Data Protection Commissioner identifies these among the rights of
              data subjects under Kenyan data protection law.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-zinc-900">18. Children and minors</h2>
            <p>
              Participants under the age of eighteen (18) must participate subject to the
              Organiser&apos;s requirements for parental or guardian consent.
            </p>
            <p className="mt-2">
              Where the Organiser processes personal information relating to a child, it will
              apply appropriate safeguards and obtain the consent required by applicable law.
              Kenya&apos;s Data Protection Act specifically provides for parental/guardian consent
              and protection of the best interests of children when processing children&apos;s
              personal data.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
