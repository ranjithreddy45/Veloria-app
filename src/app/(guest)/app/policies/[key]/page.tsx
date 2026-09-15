import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, EmptyNote, Screen, ScreenHeader } from "../../../_components/ui";
import { ContactLinks } from "../../../_components/contact-links";
import { getPublicContact } from "@/lib/public/business-contact";
import { POLICY_META, formatIstDate, getPublishedPolicy, parsePolicyParam } from "@/lib/public/policies";
import { PolicyDocument } from "../_components/policy-document";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const key = parsePolicyParam((await params).key);
  return { title: `${key ? POLICY_META[key].label : "Policy"} — Veloria Grand` };
}

/**
 * A published policy, exactly as the team published it (Settings → Customer
 * content), with its version and date. Until one is published the screen says
 * so plainly and offers the team's contact options instead of inventing terms.
 * Canonical URLs: /app/policies/cancellation-refund | house-rules | booking-terms
 * (the enum keys are accepted too).
 */
export default async function PolicyPage({ params }: Params) {
  const key = parsePolicyParam((await params).key);
  if (!key) notFound();

  const [policy, contact] = await Promise.all([getPublishedPolicy(key), getPublicContact()]);
  const label = POLICY_META[key].label;
  const hasChannel = Boolean(contact.whatsapp || contact.phone);

  return (
    <Screen>
      <ScreenHeader title={label} backHref="/app/help" />

      {policy ? (
        <PolicyDocument
          title={policy.title}
          version={policy.version}
          meta={policy.publishedAt ? `Published ${formatIstDate(policy.publishedAt)}` : null}
          body={policy.body}
        />
      ) : (
        <EmptyNote>This policy isn&apos;t published in the app yet. Please ask our team for the current terms.</EmptyNote>
      )}

      {hasChannel ? (
        <Card className="flex flex-col gap-3 p-4">
          <div>
            <div className="text-body font-semibold">{policy ? "Questions about this policy?" : "Ask us for it"}</div>
            {contact.supportHours && <div className="mt-0.5 text-detail text-[#6e6e73]">Team hours: {contact.supportHours}</div>}
          </div>
          <ContactLinks
            contact={contact}
            context={
              policy
                ? `Hi, I have a question about your ${label.toLowerCase()} (version ${policy.version}).`
                : `Hi, could you share your ${label.toLowerCase()}?`
            }
          />
        </Card>
      ) : (
        !policy && <p className="text-center text-meta text-[#6e6e73]">Our contact details aren&apos;t published in the app yet either.</p>
      )}
      <div className="h-4" />
    </Screen>
  );
}
