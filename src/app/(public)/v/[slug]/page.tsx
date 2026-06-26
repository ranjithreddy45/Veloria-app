import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";

import { getPublicBrochure, bumpBrochureView } from "@/actions/brochure-public.actions";
import { BrochureMicrosite } from "./_components/brochure-microsite";

// ============================================================
// PUBLIC digital brochure microsite — /v/<slug> (no auth).
// ------------------------------------------------------------
// The slug is the unguessable public access token. This server component reads
// ONE published brochure via getPublicBrochure (which returns only a sanitised
// DTO), 404s when missing / unpublished / venue inactive, and bumps the vanity
// view counter via after() so a slow write never delays render.
//
// SEO: a brochure is shareable marketing, so it is left indexable by default.
// The slug stays unguessable (cuid-like) so an unshared brochure isn't easily
// discovered, but published pages may be crawled.
// ============================================================

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const res = await getPublicBrochure(slug);
  if (!res.success) {
    return { title: "Not Found", robots: { index: false, follow: false } };
  }
  const b = res.data;
  const title = b.subtitle ? `${b.title} — ${b.subtitle}` : b.title;
  return {
    title: b.title,
    description: b.seoDescription || b.subtitle || `Discover ${b.title}.`,
    openGraph: {
      title,
      description: b.seoDescription || b.subtitle || undefined,
      images: b.heroImageUrl ? [{ url: b.heroImageUrl }] : undefined,
      type: "website",
    },
  };
}

export default async function BrochurePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const res = await getPublicBrochure(slug);

  if (!res.success) {
    notFound();
  }

  // Best-effort vanity view bump — never blocks/delays the render.
  after(async () => {
    await bumpBrochureView(slug);
  });

  return <BrochureMicrosite brochure={res.data} />;
}
