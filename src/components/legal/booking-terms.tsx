import { ScrollText } from "lucide-react";
import {
  BOOKING_TERMS,
  BOOKING_TERMS_VERSION,
} from "@/lib/legal/booking-terms";
import { cn } from "@/lib/utils";

// ============================================================
// BookingTerms — renders the canonical booking T&C from the single source
// (src/lib/legal/booking-terms.ts). Used on the client portal booking view and
// the internal booking detail page. Collapsed by default so it never dominates
// the page; expand to read in full.
// ============================================================

export function BookingTerms({
  defaultOpen = false,
  className,
}: {
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        "group overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card",
        className
      )}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/40">
        <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ScrollText className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-copy font-semibold tracking-[-0.01em]">
            Terms &amp; Conditions
          </h3>
          <p className="text-detail text-muted-foreground">
            Cancellation, rescheduling, guest-count &amp; venue policies · v
            {BOOKING_TERMS_VERSION}
          </p>
        </div>
        <span className="shrink-0 text-detail font-medium text-primary transition-transform group-open:rotate-180">
          ⌄
        </span>
      </summary>

      <div className="space-y-5 border-t border-border/60 px-5 py-5">
        <p className="text-detail text-muted-foreground">
          Please read carefully and retain your booking confirmation for
          reference. Your booking is subject to the following terms.
        </p>
        {BOOKING_TERMS.map((section) => (
          <section key={section.id} className="space-y-1.5">
            <h4 className="flex items-center gap-2 text-body font-semibold text-foreground">
              <span aria-hidden>{section.icon}</span>
              {section.title}
            </h4>
            <ul className="space-y-1.5 pl-1">
              {section.items.map((item, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-detail leading-relaxed text-muted-foreground"
                >
                  <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/50" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </details>
  );
}
