"use client";

// ============================================================
// FAQs: add, edit, reorder, publish/unpublish, delete, optionally tied to one
// hall. Customers see published FAQs on /app/help in this order, grouped by
// category. Reordering is computed on the server from the database.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createFaq,
  deleteFaq,
  moveFaq,
  setFaqPublished,
  updateFaq,
  type TeamFaq,
  type TeamHall,
} from "@/actions/customer-content.actions";
import type { FieldErrors } from "../../business-contact/_lib/contact-rules";
import { ALL_HALLS, validateFaqInput, type FaqField } from "../_lib/content-rules";

const amber = "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";

function HallBadge({ faq, hallById }: { faq: TeamFaq; hallById: Map<string, TeamHall> }) {
  if (!faq.venueId) return <Badge variant="outline">All halls</Badge>;
  const hall = hallById.get(faq.venueId);
  if (!hall) {
    return (
      <Badge variant="outline" className={amber}>
        Hall removed · hidden from customers
      </Badge>
    );
  }
  if (!hall.visibleToCustomers) {
    return (
      <Badge variant="outline" className={amber}>
        {hall.name} · not listed for customers, so hidden
      </Badge>
    );
  }
  return <Badge variant="outline">{hall.name}</Badge>;
}

export function FaqsPanel({ faqs, halls }: { faqs: TeamFaq[]; halls: TeamHall[] }) {
  const router = useRouter();
  const [editor, setEditor] = React.useState<{ faq: TeamFaq | null } | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<TeamFaq | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  const hallById = React.useMemo(() => new Map(halls.map((h) => [h.id, h])), [halls]);
  const categories = React.useMemo(
    () => [...new Set(faqs.map((f) => f.category).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b)),
    [faqs]
  );
  const publishedCount = faqs.filter((f) => f.isPublished).length;

  async function move(faq: TeamFaq, direction: "up" | "down") {
    setBusyId(faq.id);
    try {
      const res = await moveFaq(faq.id, direction);
      if (!res.success) toast.error(res.error);
      else router.refresh();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  async function togglePublished(faq: TeamFaq, next: boolean) {
    setBusyId(faq.id);
    try {
      const res = await setFaqPublished(faq.id, next);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(next ? "Published. Customers can see this FAQ." : "Hidden from customers.");
      router.refresh();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeletePending(true);
    try {
      const res = await deleteFaq(deleting.id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("FAQ deleted.");
      setDeleting(null);
      router.refresh();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">Frequently asked questions</CardTitle>
            <CardDescription className="mt-1">
              {publishedCount} published · {faqs.length - publishedCount} hidden. Customers see published FAQs on the Help screen, in
              this order, grouped by category.
            </CardDescription>
          </div>
          <Button onClick={() => setEditor({ faq: null })}>
            <Plus className="size-4" /> Add FAQ
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {faqs.length === 0 ? (
          <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            No FAQs yet. Add the questions customers ask your team most often.
          </p>
        ) : (
          <ul className="divide-y divide-border/70">
            {faqs.map((faq, index) => (
              <li key={faq.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start">
                <div className="flex shrink-0 gap-1 sm:flex-col">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Move up"
                    disabled={index === 0 || busyId !== null}
                    onClick={() => move(faq, "up")}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Move down"
                    disabled={index === faqs.length - 1 || busyId !== null}
                    onClick={() => move(faq, "down")}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{faq.question}</p>
                  <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">{faq.answer}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{faq.category ?? "General"}</Badge>
                    <HallBadge faq={faq} hallById={hallById} />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <label className="mr-2 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={faq.isPublished}
                      disabled={busyId === faq.id}
                      onCheckedChange={(next) => togglePublished(faq, next)}
                    />
                    {faq.isPublished ? "Published" : "Hidden"}
                  </label>
                  <Button variant="ghost" size="icon" aria-label="Edit FAQ" onClick={() => setEditor({ faq })}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Delete FAQ" className="text-destructive" onClick={() => setDeleting(faq)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {editor && (
        <FaqDialog
          key={editor.faq?.id ?? "new"}
          faq={editor.faq}
          halls={halls}
          categories={categories}
          onClose={(saved) => {
            setEditor(null);
            if (saved) router.refresh();
          }}
        />
      )}

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !deletePending) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this FAQ?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleting?.question}&rdquo; is removed from the customer app and this list. Its text stays in the Activity Log. To
              hide it without deleting, switch it to Hidden instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletePending}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deletePending && <Loader2 className="size-4 animate-spin" />}
              Delete FAQ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function FaqDialog({
  faq,
  halls,
  categories,
  onClose,
}: {
  faq: TeamFaq | null;
  halls: TeamHall[];
  categories: string[];
  onClose: (saved: boolean) => void;
}) {
  const [question, setQuestion] = React.useState(faq?.question ?? "");
  const [answer, setAnswer] = React.useState(faq?.answer ?? "");
  const [category, setCategory] = React.useState(faq?.category ?? "");
  const [venueId, setVenueId] = React.useState(faq?.venueId ?? ALL_HALLS);
  const [publishNow, setPublishNow] = React.useState(false);
  const [errors, setErrors] = React.useState<FieldErrors<FaqField>>({});
  const [saving, setSaving] = React.useState(false);

  // Halls customers can browse, plus this FAQ's current hall so an edit never silently drops it.
  const hallOptions = halls.filter((h) => h.visibleToCustomers || h.id === faq?.venueId);
  const listId = React.useId();

  async function save() {
    const input = { question, answer, category, venueId };
    const check = validateFaqInput(input);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setSaving(true);
    try {
      if (faq) {
        const res = await updateFaq(faq.id, input);
        if (!res.success) {
          if (res.fieldErrors) setErrors(res.fieldErrors);
          toast.error(res.error);
          return;
        }
        toast.success(res.data.changed ? "FAQ saved." : "No changes to save.");
      } else {
        const res = await createFaq({ ...input, isPublished: publishNow });
        if (!res.success) {
          if (res.fieldErrors) setErrors(res.fieldErrors);
          toast.error(res.error);
          return;
        }
        toast.success(publishNow ? "FAQ added and published." : "FAQ added. It stays hidden until you publish it.");
      }
      onClose(true);
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose(false);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{faq ? "Edit FAQ" : "Add FAQ"}</DialogTitle>
          <DialogDescription>Published FAQs appear on the customer Help screen. Answer the way your team would on the phone.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="faq-question">Question</Label>
            <Input
              id="faq-question"
              value={question}
              maxLength={300}
              aria-invalid={errors.question ? true : undefined}
              onChange={(e) => setQuestion(e.target.value)}
            />
            {errors.question && <p className="text-xs text-destructive">{errors.question}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="faq-answer">Answer</Label>
            <Textarea
              id="faq-answer"
              rows={5}
              value={answer}
              aria-invalid={errors.answer ? true : undefined}
              onChange={(e) => setAnswer(e.target.value)}
            />
            {errors.answer && <p className="text-xs text-destructive">{errors.answer}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="faq-category">Category</Label>
              <Input
                id="faq-category"
                list={listId}
                value={category}
                maxLength={60}
                placeholder="General"
                aria-invalid={errors.category ? true : undefined}
                onChange={(e) => setCategory(e.target.value)}
              />
              <datalist id={listId}>
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <p className={errors.category ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                {errors.category ?? "Groups FAQs on the Help screen."}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="faq-hall">Hall</Label>
              <Select value={venueId} onValueChange={setVenueId}>
                <SelectTrigger id="faq-hall" className="w-full" aria-invalid={errors.venueId ? true : undefined}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_HALLS}>All halls</SelectItem>
                  {hallOptions.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                      {h.visibleToCustomers ? "" : " (not listed for customers)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className={errors.venueId ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                {errors.venueId ?? "Pick a hall when the answer only applies there."}
              </p>
            </div>
          </div>
          {!faq && (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Switch checked={publishNow} onCheckedChange={setPublishNow} />
              Publish straight away
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {faq ? "Save FAQ" : "Add FAQ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
