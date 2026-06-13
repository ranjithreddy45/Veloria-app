"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  FileText, Plus, Check, ExternalLink, Loader2, FileSignature, Sparkles, Copy, CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusPill } from "@/components/shared/status-pill";
import { formatDate } from "@/lib/utils";
import {
  createDocument, acknowledgeDocument, upsertDocumentTemplate, renderTemplate,
} from "@/actions/hr-documents.actions";

interface Category { id: string; name: string; scope: string }
interface EmpLite { id: string; firstName: string; lastName: string; empCode: string }
interface Template { id: string; name: string; body: string }
interface OrgDoc {
  id: string; title: string; version: number; fileUrl: string | null; requiresAck: boolean;
  expiryDate: string | null; category: { name: string } | null;
  acknowledgements?: { acknowledgedAt: string }[];
  _count: { acknowledgements: number };
}

export function DocumentsHome({
  docs, categories, employees, templates, canWrite, canAdmin, totalActive,
}: {
  docs: OrgDoc[]; categories: Category[]; employees: EmpLite[]; templates: Template[];
  canWrite: boolean; canAdmin: boolean; totalActive: number;
}) {
  return (
    <Tabs defaultValue="org">
      <TabsList>
        <TabsTrigger value="org">Org documents</TabsTrigger>
        <TabsTrigger value="templates">Templates</TabsTrigger>
      </TabsList>

      <TabsContent value="org" className="space-y-3">
        {canWrite && (
          <div className="flex justify-end">
            <AddDocDialog categories={categories.filter((c) => c.scope === "ORG")} employees={employees} />
          </div>
        )}
        {docs.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
            No org documents yet. Add policies, handbooks and notices — with read-acknowledgement tracking.
          </div>
        ) : (
          <div className="space-y-2.5">
            {docs.map((d) => <OrgDocCard key={d.id} doc={d} canRead={canWrite} totalActive={totalActive} />)}
          </div>
        )}
      </TabsContent>

      <TabsContent value="templates" className="space-y-3">
        {canAdmin && (
          <div className="flex justify-end"><TemplateDialog /></div>
        )}
        {templates.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
            No templates yet. Create offer / confirmation letters with <code>{"{{firstName}}"}</code> style merge fields.
          </div>
        ) : (
          <div className="space-y-2.5">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2">
                  <FileSignature className="size-4 text-muted-foreground" />
                  <span className="font-medium">{t.name}</span>
                </div>
                <div className="flex gap-2">
                  <RenderDialog template={t} employees={employees} />
                  {canAdmin && <TemplateDialog existing={t} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

function OrgDocCard({ doc, canRead, totalActive }: { doc: OrgDoc; canRead: boolean; totalActive: number }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const acked = (doc.acknowledgements?.length ?? 0) > 0;

  async function ack() {
    setBusy(true); await acknowledgeDocument(doc.id); setBusy(false); router.refresh();
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 size-4 text-muted-foreground" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{doc.title}</span>
              <span className="text-[11px] text-muted-foreground">v{doc.version}</span>
              {doc.requiresAck && <StatusPill label="Ack required" hue="amber" size="xs" />}
            </div>
            <div className="mt-0.5 text-[12px] text-muted-foreground">
              {doc.category?.name ?? "Uncategorised"}
              {doc.expiryDate ? ` · expires ${formatDate(doc.expiryDate)}` : ""}
              {canRead && doc.requiresAck ? ` · ${doc._count.acknowledgements}/${totalActive} acknowledged` : ""}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {doc.fileUrl && (
            <Button variant="ghost" size="sm" asChild className="gap-1.5">
              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-3.5" /> Open</a>
            </Button>
          )}
          {doc.requiresAck && (
            acked ? (
              <span className="inline-flex items-center gap-1 text-[13px] font-medium text-emerald-600"><CheckCheck className="size-4" /> Acknowledged</span>
            ) : (
              <Button size="sm" className="gap-1.5" disabled={busy} onClick={ack}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Acknowledge
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export function AddDocDialog({
  categories, employees, forEmployeeId,
}: {
  categories: Category[]; employees: EmpLite[]; forEmployeeId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [scope, setScope] = React.useState(forEmployeeId ? "EMPLOYEE" : "ORG");
  const [categoryId, setCategoryId] = React.useState("");
  const [fileUrl, setFileUrl] = React.useState("");
  const [employeeId, setEmployeeId] = React.useState(forEmployeeId ?? "");
  const [requiresAck, setRequiresAck] = React.useState(false);
  const [expiryDate, setExpiryDate] = React.useState("");

  async function save() {
    setError(null);
    if (!title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    const res = await createDocument({
      title, scope, categoryId: categoryId || undefined, fileUrl: fileUrl || undefined,
      employeeId: scope === "EMPLOYEE" ? employeeId : undefined,
      requiresAck, expiryDate: expiryDate || undefined,
    });
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false); setTitle(""); setFileUrl(""); setRequiresAck(false); setExpiryDate("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="size-4" /> Add document</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add document</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label className="text-[12.5px]">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Leave Policy 2026" /></div>
          {!forEmployeeId && (
            <div className="space-y-1.5"><Label className="text-[12.5px]">Scope</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ORG">Org-wide</SelectItem>
                  <SelectItem value="EMPLOYEE">Specific employee</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {scope === "EMPLOYEE" && !forEmployeeId && (
            <div className="space-y-1.5"><Label className="text-[12.5px]">Employee</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName} · {e.empCode}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {categories.length > 0 && (
            <div className="space-y-1.5"><Label className="text-[12.5px]">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5"><Label className="text-[12.5px]">File link (Drive / storage URL)</Label>
            <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://…" /></div>
          <div className="space-y-1.5"><Label className="text-[12.5px]">Expiry date (optional)</Label>
            <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} /></div>
          {scope === "ORG" && (
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={requiresAck} onChange={(e) => setRequiresAck(e.target.checked)} className="size-4" />
              Require read-acknowledgement from everyone
            </label>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateDialog({ existing }: { existing?: Template }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState(existing?.name ?? "");
  const [body, setBody] = React.useState(existing?.body ?? "Dear {{firstName}},\n\nWe are pleased to offer you the role of {{designation}} at {{legalEntity}}, joining on {{dateOfJoining}}.\n\nWarm regards,\nPropertyPlush Group");

  async function save() {
    setError(null);
    setSaving(true);
    const res = await upsertDocumentTemplate({ id: existing?.id, name, body });
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false); router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existing ? <Button variant="outline" size="sm">Edit</Button> : <Button size="sm" className="gap-1.5"><Plus className="size-4" /> New template</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit template" : "New template"}</DialogTitle>
          <DialogDescription>Use merge fields like {"{{firstName}}"}, {"{{designation}}"}, {"{{legalEntity}}"}, {"{{dateOfJoining}}"}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label className="text-[12.5px]">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Offer letter" /></div>
          <div className="space-y-1.5"><Label className="text-[12.5px]">Body</Label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} className="h-52 w-full resize-y rounded-lg border bg-background p-3 text-[13px] outline-none focus:ring-2 focus:ring-ring" /></div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenderDialog({ template, employees }: { template: Template; employees: EmpLite[] }) {
  const [open, setOpen] = React.useState(false);
  const [employeeId, setEmployeeId] = React.useState("");
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  async function render(id: string) {
    setEmployeeId(id); setBusy(true);
    const res = await renderTemplate(template.id, id);
    setBusy(false);
    setText(res.success ? res.data.text : "");
  }
  function copy() { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5"><Sparkles className="size-3.5" /> Generate</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{template.name}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <Select value={employeeId} onValueChange={render}>
            <SelectTrigger><SelectValue placeholder="Pick an employee to merge" /></SelectTrigger>
            <SelectContent>
              {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName} · {e.empCode}</SelectItem>)}
            </SelectContent>
          </Select>
          {busy ? (
            <div className="flex justify-center py-6"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : text ? (
            <div className="rounded-lg border bg-muted/30 p-3 text-[13px] whitespace-pre-wrap">{text}</div>
          ) : null}
        </div>
        {text && (
          <DialogFooter>
            <Button variant="outline" onClick={copy} className="gap-1.5">
              {copied ? <CheckCheck className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
