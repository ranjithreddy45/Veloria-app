import type { Metadata } from "next";
import Link from "next/link";
import {
  PlusIcon,
  BadgeCheck,
  ClipboardCheck,
  Handshake,
  PenLine,
  Trophy,
  XCircle,
} from "lucide-react";
import { getAcqDeals } from "@/actions/acq-deal.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { type AcqDealCard } from "./_components/deal-board";
import { DealsWorkspace } from "./_components/deals-workspace";

export const metadata: Metadata = { title: "Deal Board" };

export default async function BdDealsPage() {
  const result = await getAcqDeals();
  const deals = (result.success ? result.data : []) as AcqDealCard[];

  // Stage-count summary for the tiles above the board (display only).
  const count = (...stages: AcqDealCard["stage"][]) =>
    deals.filter((d) => stages.includes(d.stage)).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        aura
        eyebrow="Business Development · Acquisition"
        title="Deal Board"
        help={<PageHelp id="bd-deals" />}
        description="Acquisition pipeline — drag-free guarded stages. New deals start as a qualified lead."
      >
        <Button asChild>
          {/* A BD deal is created by qualifying a lead, so "New deal" opens the
              lead capture (the proper entry to a new property acquisition). */}
          <Link href="/bd/leads?new=1">
            <PlusIcon className="size-3.5" strokeWidth={2.5} />
            New deal
          </Link>
        </Button>
      </PageHeader>

      {/* Stage counts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Qualified" value={count("QUALIFIED")} accent="cyan" icon={<BadgeCheck className="size-4" />} />
        <StatTile
          label="Evaluation"
          value={count("EVALUATION", "EVALUATION_COMPLETED")}
          accent="blue"
          icon={<ClipboardCheck className="size-4" />}
          sub="Incl. completed"
        />
        <StatTile
          label="In Negotiation"
          value={count("PROPOSAL_SENT", "NEGOTIATION", "CONTRACT_SENT")}
          accent="amber"
          icon={<Handshake className="size-4" />}
          sub="Proposal → contract"
        />
        <StatTile label="Signed" value={count("SIGNED")} accent="teal" icon={<PenLine className="size-4" />} />
        <StatTile label="Won" value={count("WON")} accent="emerald" icon={<Trophy className="size-4" />} />
        <StatTile label="Lost" value={count("LOST")} accent="rose" icon={<XCircle className="size-4" />} />
      </div>

      <DealsWorkspace deals={deals} />
    </div>
  );
}
