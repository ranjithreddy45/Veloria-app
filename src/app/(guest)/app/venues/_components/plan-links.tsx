import Link from "next/link";
import { Calculator, CalendarCheck, ChefHat, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE_VISIT_KIND_TAGLINE } from "@/lib/site-visit/slots";
import { Card, IconTile } from "../../../_components/ui";
import { quoteHref, visitHref } from "../_lib/links";

/**
 * Planning links: the public /visit scheduler (venue tour, menu tasting) and
 * the /configure instant quote, prefilled with the hall and event type when
 * known. The taglines are the scheduler's own copy.
 *
 * Set showQuote={false} for a hall that requires its in-house caterer: the
 * configurator prices the house catering menu, which that hall doesn't use.
 */
export function PlanLinks({
  venueId,
  eventType,
  quoteVenueId,
  showQuote = true,
  className,
}: {
  /** Prefills the hall on /visit. */
  venueId?: string | null;
  eventType?: string | null;
  /** Prefills the hall on /configure. */
  quoteVenueId?: string | null;
  showQuote?: boolean;
  className?: string;
}) {
  const items = [
    { href: visitHref({ kind: "SITE_VISIT", venueId, eventType }), Icon: CalendarCheck, title: "Book a site visit", sub: SITE_VISIT_KIND_TAGLINE.SITE_VISIT },
    { href: visitHref({ kind: "MENU_TASTING", venueId, eventType }), Icon: ChefHat, title: "Book a food tasting", sub: SITE_VISIT_KIND_TAGLINE.MENU_TASTING },
    ...(showQuote ? [{ href: quoteHref({ venueId: quoteVenueId }), Icon: Calculator, title: "Get an instant quote", sub: "Build your package and see a live price." }] : []),
  ];
  return (
    <Card className={cn("vg-divide overflow-hidden", className)}>
      {items.map(({ href, Icon, title, sub }) => (
        <Link key={title} href={href} className="flex min-h-[60px] items-center gap-3 px-4 py-3 text-left">
          <IconTile size={36}>
            <Icon className="size-[18px]" strokeWidth={1.9} aria-hidden />
          </IconTile>
          <span className="min-w-0 flex-1">
            <span className="block text-body font-semibold text-[#1d1d1f]">{title}</span>
            <span className="block text-meta leading-[1.4] text-[#6e6e73]">{sub}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-[#c7c7cc]" aria-hidden />
        </Link>
      ))}
    </Card>
  );
}
