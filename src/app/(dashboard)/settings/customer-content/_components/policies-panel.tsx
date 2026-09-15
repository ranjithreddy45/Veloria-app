"use client";

// ============================================================
// Policies: draft → preview → publish. The preview renders the draft with the
// customer page's own <PolicyDocument>, so what the team approves is what goes
// live. Publishing sends the draft's updatedAt as seen in the preview; the
// server refuses if the draft changed since.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ExternalLink, Eye, EyeOff, Loader2, Pencil, Save, Send, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  discardPolicyDraft,
  publishPolicyDraft,
  savePolicyDraft,
  unpublishPolicy,
  type TeamPolicy,
} from "@/actions/customer-content.actions";
import { PolicyDocument } from "@/app/(guest)/app/policies/_components/policy-document";
import type { FieldErrors } from "../../business-contact/_lib/contact-rules";
import { formatIstDate, isSameAsLive, validatePolicyDraft, type PolicyDraftField } from "../_lib/content-rules";

export function PoliciesPanel({ policies }: { policies: TeamPolicy[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Write or change a policy as a draft, preview it exactly as customers will see it, then publish. Customers keep
        reading the live version until you do. Formatting: a blank line starts a new paragraph, &ldquo;- &rdquo; makes a
        bullet, &ldquo;1. &rdquo; a numbered point and &ldquo;# &rdquo; a heading.
      </p>
      {policies.map((policy) => (
        <PolicyCard key={policy.key} policy={policy} />
      ))}
    </div>
  );
}

function stamp(iso: string | null, by: string | null): string {
  if (!iso) return "";
  return `${formatIstDate(iso, { withTime: true })}${by ? ` by ${by}` : ""}`;
}

type Pending = null | "save" | "publish" | "discard" | "unpublish";

function PolicyCard({ policy }: { policy: TeamPolicy }) {
  const router = useRouter();
  const { live, draft } = policy;
  const isLive = !!live?.isPublished;
  const wasLive = !!live && !live.isPublished && !!live.publishedAt;

  const [editing, setEditing] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [errors, setErrors] = React.useState<FieldErrors<PolicyDraftField>>({});
  const [pending, setPending] = React.useState<Pending>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState<null | "discard" | "unpublish">(null);
  const [showLive, setShowLive] = React.useState(false);

  function startEditing() {
    setTitle(draft?.title ?? live?.title ?? policy.label);
    setBody(draft?.body ?? live?.body ?? "");
    setErrors({});
    setEditing(true);
  }

  async function saveDraft() {
    const check = validatePolicyDraft({ title, body });
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setPending("save");
    try {
      const res = await savePolicyDraft({ key: policy.key, title, body });
      if (!res.success) {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast.error(res.error);
        return;
      }
      toast.success(
        isLive
          ? `Draft saved. Customers still see version ${live?.version} until you publish.`
          : "Draft saved. Nothing changes for customers until you publish."
      );
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setPending(null);
    }
  }

  async function publish() {
    if (!draft) return;
    setPending("publish");
    try {
      const res = await publishPolicyDraft({ key: policy.key, draftUpdatedAt: draft.updatedAt });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`Version ${res.data.version} is live for customers.`);
      setPreviewOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setPending(null);
    }
  }

  async function runConfirm() {
    const kind = confirm;
    if (!kind) return;
    setPending(kind);
    try {
      const res = kind === "discard" ? await discardPolicyDraft(policy.key) : await unpublishPolicy(policy.key);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(kind === "discard" ? "Draft discarded." : "Taken offline. Customers now see that it isn't published.");
      setConfirm(null);
      router.refresh();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">{policy.label}</CardTitle>
            <CardDescription className="mt-1">{policy.teamHint}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {isLive ? (
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                Live · v{live?.version}
              </Badge>
            ) : wasLive ? (
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                Offline · was v{live?.version}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Not published
              </Badge>
            )}
            {draft && (
              <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300">
                Draft · becomes v{policy.nextVersion}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customers see</dt>
            <dd className="mt-1">
              {isLive && live ? (
                <>
                  Version {live.version}, &ldquo;{live.title}&rdquo; — published {stamp(live.publishedAt, live.updatedByName)}.
                </>
              ) : wasLive && live ? (
                <>
                  Nothing: version {live.version} was taken offline {stamp(live.updatedAt, live.updatedByName)}. The policy page says
                  it isn&apos;t published yet.
                </>
              ) : (
                <>Nothing yet. The policy page says it isn&apos;t published yet and shows your contact options.</>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Draft</dt>
            <dd className="mt-1">
              {draft ? (
                <>
                  Saved {stamp(draft.updatedAt, draft.updatedByName)}. Publishing it creates version {policy.nextVersion}.
                </>
              ) : (
                "No draft."
              )}
            </dd>
          </div>
        </dl>

        {editing ? (
          <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${policy.key}-title`}>Title customers see</Label>
              <Input
                id={`${policy.key}-title`}
                value={title}
                maxLength={120}
                aria-invalid={errors.title ? true : undefined}
                onChange={(e) => setTitle(e.target.value)}
              />
              {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${policy.key}-body`}>Policy text</Label>
              <Textarea
                id={`${policy.key}-body`}
                rows={14}
                value={body}
                aria-invalid={errors.body ? true : undefined}
                onChange={(e) => setBody(e.target.value)}
                className="font-mono text-[13px] leading-relaxed"
              />
              <p className={errors.body ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                {errors.body ?? "Blank line = new paragraph · “- ” bullet · “1. ” numbered point · “# ” heading"}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(false)} disabled={pending === "save"}>
                Cancel
              </Button>
              <Button onClick={saveDraft} disabled={pending === "save"}>
                {pending === "save" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save draft
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {draft ? (
              <>
                <Button onClick={() => setPreviewOpen(true)}>
                  <Eye className="size-4" /> Preview &amp; publish
                </Button>
                <Button variant="outline" onClick={startEditing}>
                  <Pencil className="size-4" /> Edit draft
                </Button>
                <Button variant="ghost" className="text-destructive" onClick={() => setConfirm("discard")}>
                  <Trash2 className="size-4" /> Discard draft
                </Button>
              </>
            ) : (
              <Button variant={live ? "outline" : "default"} onClick={startEditing}>
                <Pencil className="size-4" /> {live ? "Start a new draft" : "Write this policy"}
              </Button>
            )}
            {isLive && (
              <>
                <Button variant="ghost" asChild>
                  <a href={policy.path} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4" /> View in customer app
                  </a>
                </Button>
                <Button variant="ghost" className="text-muted-foreground" onClick={() => setConfirm("unpublish")}>
                  <EyeOff className="size-4" /> Take offline
                </Button>
              </>
            )}
          </div>
        )}

        {live && !editing && (
          <div>
            <button
              type="button"
              onClick={() => setShowLive((s) => !s)}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              aria-expanded={showLive}
            >
              <ChevronDown className={cn("size-3.5 transition-transform", showLive && "rotate-180")} />
              {showLive ? "Hide" : "Show"} {isLive ? "the live" : "the last published"} text (v{live.version})
            </button>
            {showLive && (
              <div className="mt-2 rounded-2xl bg-[#f3f0ec] p-4">
                <PolicyDocument
                  title={live.title}
                  version={live.version}
                  meta={live.publishedAt ? `Published ${formatIstDate(live.publishedAt)}` : null}
                  body={live.body}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>

      {draft && (
        <Dialog open={previewOpen} onOpenChange={(open) => pending !== "publish" && setPreviewOpen(open)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Preview — {policy.label}</DialogTitle>
              <DialogDescription>
                Exactly what customers will read at {policy.path}. Publishing makes it live straight away as version{" "}
                {policy.nextVersion}
                {isLive ? `, replacing version ${live?.version}` : ""}.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-2xl bg-[#f3f0ec] p-4">
              <PolicyDocument title={draft.title} version={policy.nextVersion} meta="Dated the moment you publish" body={draft.body} />
            </div>
            {isSameAsLive(draft, live) && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                This draft is word-for-word the live version {live?.version}. Publishing it still creates version {policy.nextVersion}.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              A customer consent stores the version it was given against, so earlier consents keep pointing at their own text.
              The published text is saved in full to the Activity Log.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewOpen(false)} disabled={pending === "publish"}>
                Not yet
              </Button>
              <Button onClick={publish} disabled={pending === "publish"}>
                {pending === "publish" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Publish version {policy.nextVersion}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "unpublish" ? `Take ${policy.label.toLowerCase()} offline?` : "Discard this draft?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "unpublish"
                ? `Customers will see that it isn't published yet, with your contact options, until you publish a new version. Version ${live?.version ?? ""} stays on record.`
                : "The draft text is deleted. What customers see does not change."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending !== null}
              onClick={(e) => {
                e.preventDefault();
                void runConfirm();
              }}
            >
              {pending !== null && <Loader2 className="size-4 animate-spin" />}
              {confirm === "unpublish" ? "Take offline" : "Discard draft"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
