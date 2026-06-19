import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getWhiteLabelStorefront } from "@/actions/franchise-storefront.actions";
import { WhiteLabelShell } from "./_components/white-label-shell";

// ============================================================
// PUBLIC white-label storefront — /s/<slug> (no auth)
// ============================================================
// The slug is the unguessable public access token. Exposes ONLY the public
// venue detail (via getStorefrontVenue) plus brand theming. 404 when not
// found / not live / venue inactive.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getWhiteLabelStorefront(slug);
  if (!data) {
    return { title: "Not Found" };
  }
  const title = data.brandName || data.venue.name;
  return {
    title,
    description: data.venue.description || `Enquire about ${data.venue.name}.`,
  };
}

export default async function WhiteLabelStorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getWhiteLabelStorefront(slug);

  if (!data) {
    notFound();
  }

  return (
    <WhiteLabelShell
      brandName={data.brandName}
      logoUrl={data.logoUrl}
      primaryColor={data.primaryColor}
      venue={data.venue}
    />
  );
}
