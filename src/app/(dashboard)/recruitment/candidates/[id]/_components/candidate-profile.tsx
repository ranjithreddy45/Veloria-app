"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Mail, MapPin, Phone, Radio, Star } from "lucide-react";
import { toast } from "sonner";

import { updateCandidateNotes } from "@/actions/recruit-candidate.actions";
import { StatusPill } from "@/components/shared/status-pill";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import {
  CANDIDATE_STAGE_HUE,
  CANDIDATE_STAGE_LABEL,
  initialsOf,
  tintFor,
  type CandidateView,
} from "./shared";

function RatingStars({ value }: { value: number }) {
  const v = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <div className="inline-flex items-center gap-1.5" title={`${v}/5`}>
      <div className="flex items-center gap-px">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              "size-4",
              i < v ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
            )}
          />
        ))}
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{v}/5</span>
    </div>
  );
}

function InfoRow({
  icon,
  value,
}: {
  icon: React.ReactNode;
  value: string | null;
}) {
  return (
    <div className="flex items-center gap-2.5 text-[13px]">
      <span className="text-muted-foreground">{icon}</span>
      <span className={cn("truncate", value ? "text-foreground/90" : "text-muted-foreground")}>
        {value || "—"}
      </span>
    </div>
  );
}

export function CandidateProfile({
  candidate,
  canWrite,
}: {
  candidate: CandidateView;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = React.useState(candidate.notes ?? "");
  const [pending, setPending] = React.useState(false);
  const dirty = notes !== (candidate.notes ?? "");

  async function saveNotes() {
    setPending(true);
    const res = await updateCandidateNotes(candidate.id, notes);
    setPending(false);
    if (res.success) {
      toast.success("Notes saved.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-5 lg:sticky lg:top-5 lg:self-start">
      <Card className="overflow-hidden p-0 shadow-card">
        <div className="flex flex-col items-center gap-3 px-5 pb-4 pt-6 text-center">
          <Avatar size="lg" className="size-16">
            <AvatarFallback
              className={cn("text-lg font-semibold", tintFor(candidate.id))}
            >
              {initialsOf(candidate.name)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h2 className="text-base font-medium text-foreground">{candidate.name}</h2>
            <StatusPill
              label={CANDIDATE_STAGE_LABEL[candidate.stage] ?? candidate.stage}
              hue={CANDIDATE_STAGE_HUE[candidate.stage] ?? "neutral"}
              size="sm"
            />
          </div>
          <RatingStars value={candidate.rating} />
        </div>

        <Separator />

        <div className="space-y-2.5 px-5 py-4">
          <InfoRow icon={<Mail className="size-4" />} value={candidate.email} />
          <InfoRow icon={<Phone className="size-4" />} value={candidate.phone} />
          <InfoRow icon={<MapPin className="size-4" />} value={candidate.city} />
          <InfoRow icon={<Radio className="size-4" />} value={candidate.source} />
        </div>
      </Card>

      <Card className="space-y-3 p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-medium text-foreground">Notes</h3>
          {canWrite && dirty && (
            <Button size="sm" variant="outline" onClick={saveNotes} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          )}
        </div>
        {canWrite ? (
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add private notes about this candidate…"
            rows={5}
            className="resize-none text-[13px]"
          />
        ) : (
          <p className="whitespace-pre-wrap text-[13px] text-muted-foreground">
            {candidate.notes || "No notes."}
          </p>
        )}
      </Card>
    </div>
  );
}
