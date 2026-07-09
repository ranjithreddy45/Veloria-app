"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { StickyNote, Phone, Pencil, Trash2, Check, X, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { listCrmNotes, addCrmNote, editCrmNote, deleteCrmNote, type CrmNoteDTO } from "@/actions/crm-note.actions";

const CALL_OUTCOMES = [
  { v: "CONNECTED", l: "Connected" },
  { v: "NO_ANSWER", l: "No answer" },
  { v: "BUSY", l: "Busy" },
  { v: "FOLLOW_UP", l: "Needs follow-up" },
];

const timeAgo = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

/** Editable notes + call log for a lead or an enquiry. Multiple notes; author edits/deletes own. */
export function CrmNotesPanel({ leadId, inquiryId }: { leadId?: string; inquiryId?: string }) {
  const [notes, setNotes] = useState<CrmNoteDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"NOTE" | "CALL">("NOTE");
  const [callOutcome, setCallOutcome] = useState("CONNECTED");
  const [editId, setEditId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const load = useCallback(async () => {
    const res = await listCrmNotes({ leadId, inquiryId });
    if (res.success) setNotes(res.data);
    setLoading(false);
  }, [leadId, inquiryId]);

  useEffect(() => { load(); }, [load]);

  async function add() {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    try {
      const res = await addCrmNote({ leadId, inquiryId, kind: mode, body, callOutcome: mode === "CALL" ? callOutcome : null });
      if (!res.success) { toast.error(res.error); return; }
      setDraft("");
      toast.success(mode === "CALL" ? "Call logged" : "Note added");
      await load();
    } finally { setBusy(false); }
  }

  async function saveEdit(id: string) {
    const body = editBody.trim();
    if (!body) return;
    setBusy(true);
    try {
      const res = await editCrmNote(id, { body });
      if (!res.success) { toast.error(res.error); return; }
      setEditId(null);
      await load();
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const res = await deleteCrmNote(id);
      if (!res.success) { toast.error(res.error); return; }
      await load();
    } finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><StickyNote className="size-4 text-violet-600" /> Notes & calls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Composer */}
        <div className="space-y-2 rounded-lg border bg-muted/30 p-2.5">
          <div className="flex items-center gap-2">
            <Button size="sm" variant={mode === "NOTE" ? "default" : "outline"} className="h-7 gap-1.5" onClick={() => setMode("NOTE")}><StickyNote className="size-3.5" /> Note</Button>
            <Button size="sm" variant={mode === "CALL" ? "default" : "outline"} className="h-7 gap-1.5" onClick={() => setMode("CALL")}><Phone className="size-3.5" /> Log call</Button>
            {mode === "CALL" && (
              <Select value={callOutcome} onValueChange={setCallOutcome}>
                <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{CALL_OUTCOMES.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder={mode === "CALL" ? "What was discussed on the call?" : "Add a note…"} className="text-sm" />
          <Button size="sm" className="gap-1.5" onClick={add} disabled={busy || !draft.trim()}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} {mode === "CALL" ? "Log call" : "Add note"}
          </Button>
        </div>

        {/* Timeline */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-lg border p-2.5 text-sm">
                <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  {n.kind === "CALL" ? <Phone className="size-3.5 text-blue-600" /> : <StickyNote className="size-3.5" />}
                  {n.kind === "CALL" && n.callOutcome && <Badge variant="outline" className="h-4 px-1 text-[10px]">{CALL_OUTCOMES.find((o) => o.v === n.callOutcome)?.l ?? n.callOutcome}</Badge>}
                  <span>{n.authorName ?? "Someone"}</span>
                  <span>· {timeAgo(n.createdAt)}</span>
                  {n.editedAt && <span className="italic">(edited)</span>}
                  {n.canEdit && editId !== n.id && (
                    <span className="ml-auto flex gap-1">
                      <button className="text-muted-foreground hover:text-foreground" onClick={() => { setEditId(n.id); setEditBody(n.body); }}><Pencil className="size-3.5" /></button>
                      <button className="text-muted-foreground hover:text-destructive" onClick={() => remove(n.id)}><Trash2 className="size-3.5" /></button>
                    </span>
                  )}
                </div>
                {editId === n.id ? (
                  <div className="space-y-1.5">
                    <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={2} className="text-sm" />
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-7 gap-1" onClick={() => saveEdit(n.id)} disabled={busy}><Check className="size-3.5" /> Save</Button>
                      <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => setEditId(null)}><X className="size-3.5" /> Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{n.body}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
