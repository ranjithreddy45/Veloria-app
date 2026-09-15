"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { applyUniqueGuard, type UniqueGuardStatus } from "@/actions/unique-guards.actions";

/**
 * "Database guards" — one row per hard unique index the app can hold over its
 * normalised phone/email keys. A guard can only be applied once its table has
 * no duplicate groups, so the row either shows Protected, the number of groups
 * still blocking it (with a pointer to the merge tools above), or an Apply
 * button. Guards flagged manual are never applied by the deploy bootstrap.
 */
export function DatabaseGuards({
  guards,
  loadError,
}: {
  guards: UniqueGuardStatus[];
  loadError?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [applying, setApplying] = useState<string | null>(null);

  function apply(guard: UniqueGuardStatus) {
    setApplying(guard.name);
    startTransition(async () => {
      const res = await applyUniqueGuard(guard.name);
      setApplying(null);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      if (res.data.applied) {
        toast.success(`${guard.label}: protected. Duplicates on this key can no longer be created.`);
      } else if (res.data.alreadyProtected) {
        toast.info(`${guard.label} is already protected.`);
      } else {
        toast.warning(
          `${guard.label}: ${res.data.duplicateGroups} duplicate group${
            res.data.duplicateGroups === 1 ? "" : "s"
          } still exist. Merge them above first.`
        );
      }
      router.refresh();
    });
  }

  const manualCount = guards.filter((g) => !g.autoApply).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Database guards</CardTitle>
        <CardDescription>
          Hard unique indexes on the normalised phone / email keys, so a duplicate can never be
          created again — not even by a webhook or import that bypasses the app&rsquo;s own checks.
          A guard can only go on once its table is clean: clear any groups with the{" "}
          <a href="#duplicate-groups" className="font-medium text-primary hover:underline">
            merge tools above
          </a>{" "}
          first.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loadError && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-meta text-destructive">
            {loadError}
          </p>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guard</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Blocking keys</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {guards.map((g) => {
                const busy = pending && applying === g.name;
                const canApply = !g.error && !g.indexValid && g.duplicateGroups === 0;
                return (
                  <TableRow key={g.name}>
                    <TableCell className="align-top">
                      <span className="block text-body font-medium">{g.label}</span>
                      <span className="block text-meta text-muted-foreground">
                        <code className="font-mono">{g.table}</code> · {g.keyType} ·{" "}
                        {g.autoApply ? "auto-applied on deploy when clean" : "manual apply"}
                      </span>
                    </TableCell>
                    <TableCell className="align-top">
                      <StatusPill guard={g} />
                    </TableCell>
                    <TableCell className="hidden align-top sm:table-cell">
                      {g.samples.length > 0 ? (
                        <ul className="space-y-0.5">
                          {g.samples.map((s) => (
                            <li key={s.key} className="text-meta text-muted-foreground">
                              <code className="font-mono text-foreground">{s.key}</code> ×{s.count}
                            </li>
                          ))}
                          {g.duplicateGroups > g.samples.length && (
                            <li className="text-meta text-muted-foreground">
                              +{g.duplicateGroups - g.samples.length} more
                            </li>
                          )}
                        </ul>
                      ) : (
                        <span className="text-meta text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right align-top">
                      {g.indexValid ? (
                        <span className="text-meta text-muted-foreground">Nothing to do</span>
                      ) : canApply ? (
                        <Button size="sm" variant="outline" onClick={() => apply(g)} disabled={pending}>
                          {busy ? "Applying…" : g.indexExists ? "Rebuild" : "Apply"}
                        </Button>
                      ) : g.duplicateGroups > 0 ? (
                        <a
                          href="#duplicate-groups"
                          className="text-meta font-medium text-primary hover:underline"
                        >
                          Merge first
                        </a>
                      ) : (
                        <span className="text-meta text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {manualCount > 0 && (
          <p className="text-meta text-muted-foreground">
            Contact guards are marked <span className="font-medium text-foreground">manual apply</span>{" "}
            because some public booking flows still look an existing contact up by the exact phone
            string before creating one; once every create path uses the normalised lookup, those
            guards can be applied here and the deploy bootstrap will keep them in place.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StatusPill({ guard }: { guard: UniqueGuardStatus }) {
  if (guard.error) {
    return <Badge variant="destructive">Status unavailable</Badge>;
  }
  if (guard.indexValid) {
    return <Badge variant="success">Protected</Badge>;
  }
  if (guard.indexExists) {
    // A CONCURRENTLY build that failed part-way leaves an invalid index — no protection.
    return <Badge variant="destructive">Invalid index</Badge>;
  }
  if (guard.duplicateGroups > 0) {
    return (
      <Badge variant="warning">
        {guard.duplicateGroups} duplicate group{guard.duplicateGroups === 1 ? "" : "s"}
      </Badge>
    );
  }
  return <Badge variant="outline">Not applied</Badge>;
}
