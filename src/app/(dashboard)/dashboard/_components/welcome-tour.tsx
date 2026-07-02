"use client";

// ============================================================
// Welcome tour — a one-time, dismissible orientation for brand-new users.
// Shows the 4 things that make the app fast to use (Create, Search, Help,
// Getting Started). Gated by localStorage so it appears once, never nags.
// Reliable modal (not DOM-spotlight) so it works on every screen size.
// ============================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus, Search, CircleHelp, Sparkles, ArrowRight, ArrowLeft, PartyPopper,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SEEN_KEY = "vg_welcome_seen_v1";

const STEPS = [
  {
    icon: PartyPopper, tone: "text-violet-500",
    title: "Welcome to Veloria Grand",
    body: "Your command centre for enquiries, quotations, bookings, payments and operations — all in one place. Here are 4 things that make it fast.",
  },
  {
    icon: Plus, tone: "text-primary",
    title: "Create anything in one tap",
    body: "The “+ Create” button in the top bar makes a new enquiry, quotation, booking, contact or invoice from any page — no hunting around.",
  },
  {
    icon: Search, tone: "text-sky-500",
    title: "Find anything instantly",
    body: "Use the search bar (or press ⌘K / Ctrl-K) to jump to any customer, booking, quote or page in seconds.",
  },
  {
    icon: CircleHelp, tone: "text-emerald-500",
    title: "Help is always one click away",
    body: "The “?” in the top bar opens the guided Playbook and tips. And the “Getting started” checklist below walks you through your first enquiry to your first payment.",
  },
];

export function WelcomeTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY) !== "1") setOpen(true);
    } catch {
      /* private mode — just skip the tour */
    }
  }, []);

  const finish = () => {
    try { localStorage.setItem(SEEN_KEY, "1"); } catch {}
    setOpen(false);
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const Icon = current.icon;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) finish(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className={cn("mb-2 flex size-12 items-center justify-center rounded-2xl bg-muted", current.tone)}>
            <Icon className="size-6" />
          </div>
          <DialogTitle className="text-[18px]">{current.title}</DialogTitle>
          <DialogDescription className="text-[13.5px] leading-relaxed">{current.body}</DialogDescription>
        </DialogHeader>

        {/* Step dots */}
        <div className="flex items-center gap-1.5 py-1">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/25"
              )}
            />
          ))}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={finish}>
            Skip
          </Button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft className="size-4" /> Back
              </Button>
            )}
            {isLast ? (
              <Button size="sm" asChild onClick={finish}>
                <Link href="/playbook"><Sparkles className="size-4" /> Explore the Playbook</Link>
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                Next <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
