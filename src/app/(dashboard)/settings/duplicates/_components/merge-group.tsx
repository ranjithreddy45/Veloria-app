"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { mergeContacts } from "@/actions/dedup.actions";

interface Member {
  id: string;
  label: string;
  href: string;
  detail?: string;
}

/**
 * One contact duplicate group with a merge control. The admin picks the record
 * to KEEP; every other record in the group is merged into it (their leads,
 * bookings, quotes etc. move over) and then hidden. Only rendered for Contact
 * groups — other entity types stay read-only for now.
 */
export function MergeGroup({ members }: { members: Member[] }) {
  const router = useRouter();
  const [keepId, setKeepId] = useState<string>(members[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const loserIds = members.filter((m) => m.id !== keepId).map((m) => m.id);

  function doMerge() {
    startTransition(async () => {
      const res = await mergeContacts(keepId, loserIds);
      if (res.success) {
        toast.success(
          `Merged ${res.movedFrom} duplicate${res.movedFrom === 1 ? "" : "s"} into the kept record.`
        );
        setConfirming(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border/60">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 py-2">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
              <input
                type="radio"
                name={`keep-${members[0]?.id}`}
                className="size-4 shrink-0"
                checked={keepId === m.id}
                onChange={() => setKeepId(m.id)}
              />
              <span className="min-w-0">
                <span className="block truncate text-body font-medium">{m.label}</span>
                {m.detail && (
                  <span className="block truncate text-meta text-muted-foreground">{m.detail}</span>
                )}
              </span>
            </label>
            <div className="flex shrink-0 items-center gap-3">
              {keepId === m.id ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-meta font-medium text-emerald-700 ring-1 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/50">
                  Keep
                </span>
              ) : (
                <span className="text-meta text-muted-foreground">will merge in</span>
              )}
              <Link href={m.href} className="text-body font-medium text-primary hover:underline">
                Open →
              </Link>
            </div>
          </li>
        ))}
      </ul>

      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200/80 bg-amber-50 p-2.5 dark:border-amber-800/50 dark:bg-amber-950/40">
          <span className="text-meta text-amber-800 dark:text-amber-300">
            Merge {loserIds.length} record{loserIds.length === 1 ? "" : "s"} into the kept one? Their
            leads, bookings and history move over; the extras are hidden. This can&rsquo;t be auto-undone.
          </span>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
              Cancel
            </Button>
            <Button size="sm" onClick={doMerge} disabled={pending}>
              {pending ? "Merging…" : "Confirm merge"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirming(true)}
            disabled={loserIds.length === 0}
          >
            Merge {loserIds.length} into kept
          </Button>
        </div>
      )}
    </div>
  );
}
