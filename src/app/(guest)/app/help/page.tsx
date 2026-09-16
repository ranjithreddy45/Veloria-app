import type { Metadata } from "next";
import { ChevronDown, Clock, MapPin } from "lucide-react";
import { Card, EmptyNote, Pill, Row, Screen, ScreenHeader, SectionTitle } from "../../_components/ui";
import { ContactLinks } from "../../_components/contact-links";
import { formatPhoneForDisplay, getPublicContact } from "@/lib/public/business-contact";
import {
  POLICY_KEYS,
  POLICY_META,
  formatIstDate,
  getPublishedFaqs,
  getPublishedPolicies,
  groupFaqsForDisplay,
  policyPath,
} from "@/lib/public/policies";
import { PolicyBody } from "../policies/_components/policy-body";

export const metadata: Metadata = { title: "Help & contact — Veloria Grand" };
export const dynamic = "force-dynamic";

/**
 * Public help screen. Everything on it is what the team published in
 * Settings → Business contact and Settings → Customer content, read from the
 * same rows; a section with nothing published is left out, not filled in.
 */
export default async function HelpPage() {
  const [contact, policies, faqs] = await Promise.all([getPublicContact(), getPublishedPolicies(), getPublishedFaqs()]);
  const groups = groupFaqsForDisplay(faqs);
  const houseRules = policies.find((p) => p.key === "HOUSE_RULES") ?? null;
  const hasChannel = Boolean(contact.whatsapp || contact.phone || contact.email);
  const hasLocation = Boolean(contact.address || contact.mapUrl);

  return (
    <Screen>
      <ScreenHeader title="Help & contact" backHref="/app" />

      {/* Talk to us */}
      <section className="flex flex-col gap-3">
        <SectionTitle title="Talk to us" />
        {hasChannel || hasLocation ? (
          <Card className="flex flex-col gap-3.5 p-4">
            {(contact.displayName || contact.supportHours) && (
              <div>
                {contact.displayName && <div className="text-copy font-semibold">{contact.displayName}</div>}
                {contact.supportHours && (
                  <div className="mt-0.5 flex items-center gap-1.5 text-detail text-[#6e6e73]">
                    <Clock className="size-3.5 shrink-0" aria-hidden />
                    <span>
                      <span className="sr-only">Team hours: </span>
                      {contact.supportHours}
                    </span>
                  </div>
                )}
              </div>
            )}
            <ContactLinks
              contact={contact}
              withEmail
              context={`Hi, I have a question${contact.displayName ? ` for ${contact.displayName}` : ""}.`}
            />
            {hasChannel && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-detail">
                {contact.phone && (
                  <>
                    <dt className="text-[#6e6e73]">Phone</dt>
                    <dd className="numeric font-medium">{formatPhoneForDisplay(contact.phone)}</dd>
                  </>
                )}
                {contact.whatsapp && (
                  <>
                    <dt className="text-[#6e6e73]">WhatsApp</dt>
                    <dd className="numeric font-medium">{formatPhoneForDisplay(contact.whatsapp)}</dd>
                  </>
                )}
                {contact.email && (
                  <>
                    <dt className="text-[#6e6e73]">Email</dt>
                    <dd className="break-all font-medium">{contact.email}</dd>
                  </>
                )}
              </dl>
            )}
            {hasLocation && (
              <div className="flex items-start gap-2 border-t border-black/[.06] pt-3 text-detail">
                <MapPin className="mt-0.5 size-4 shrink-0 text-[#6d1b52]" aria-hidden />
                <div className="min-w-0">
                  {contact.address && <address className="whitespace-pre-line not-italic leading-[1.5] text-[#3a3a3c]">{contact.address}</address>}
                  {contact.mapUrl && (
                    <a href={contact.mapUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-semibold text-[#6d1b52]">
                      Open in Maps
                    </a>
                  )}
                </div>
              </div>
            )}
          </Card>
        ) : (
          <EmptyNote>Our contact details haven&apos;t been published in the app yet.</EmptyNote>
        )}
      </section>

      {/* FAQs, grouped by category; hall-specific answers carry the hall's name */}
      {groups.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle title="Questions & answers" />
          {groups.map((group) => (
            <div key={group.title} className="flex flex-col gap-2">
              {groups.length > 1 && <div className="px-1 text-meta font-semibold uppercase tracking-[.08em] text-[#636368]">{group.title}</div>}
              <Card className="vg-divide overflow-hidden">
                {group.items.map((faq) => (
                  <details key={faq.id} className="group">
                    <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-3 px-4 py-3.5 text-left text-copy [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0 flex-1">
                        <span className="block">{faq.question}</span>
                        {faq.hallName && (
                          <Pill tone="plum" className="mt-1.5">
                            {faq.hallName}
                          </Pill>
                        )}
                      </span>
                      <ChevronDown className="size-4 shrink-0 text-[#c7c7cc] transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <p className="whitespace-pre-line px-4 pb-4 text-body leading-[1.6] text-[#3a3a3c]">{faq.answer}</p>
                  </details>
                ))}
              </Card>
            </div>
          ))}
        </section>
      )}

      {/* House rules, when published */}
      {houseRules && (
        <section className="flex flex-col gap-3">
          <SectionTitle title="House rules" action={{ label: "Open", href: policyPath("HOUSE_RULES") }} />
          <Card className="p-4">
            <div className="text-copy font-semibold">{houseRules.title}</div>
            <div className="mt-0.5 text-meta text-[#6e6e73]">
              Version {houseRules.version}
              {houseRules.publishedAt ? ` · Published ${formatIstDate(houseRules.publishedAt)}` : ""}
            </div>
            <PolicyBody body={houseRules.body} className="mt-3" />
          </Card>
        </section>
      )}

      {/* Policies */}
      <section className="flex flex-col gap-3">
        <SectionTitle title="Policies" />
        {policies.length > 0 ? (
          <Card className="vg-divide overflow-hidden">
            {POLICY_KEYS.map((key) => {
              const p = policies.find((x) => x.key === key);
              return (
                <Row key={key} href={policyPath(key)} detail={p ? `v${p.version}` : "Not published yet"}>
                  {p?.title ?? POLICY_META[key].label}
                </Row>
              );
            })}
          </Card>
        ) : (
          <EmptyNote>Our policies haven&apos;t been published in the app yet. Please ask our team for the current terms.</EmptyNote>
        )}
      </section>
      <div className="h-4" />
    </Screen>
  );
}
