"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Pencil, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { revealStatutory, upsertStatutory, type StatutoryMasked } from "@/actions/hr-statutory.actions";

export function StatutoryPanel({ employeeId, masked }: { employeeId: string; masked: StatutoryMasked }) {
  const [revealed, setRevealed] = React.useState<{ pan: string | null; aadhaar: string | null; bankAccount: string | null } | null>(null);
  const [revealing, setRevealing] = React.useState(false);

  async function toggleReveal() {
    if (revealed) { setRevealed(null); return; }
    setRevealing(true);
    const res = await revealStatutory(employeeId);
    setRevealing(false);
    if (res.success) setRevealed(res.data);
  }

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-success" />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Statutory &amp; bank</h3>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={toggleReveal} disabled={revealing}>
            {revealing ? <Loader2 className="size-3.5 animate-spin" /> : revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {revealed ? "Hide" : "Reveal"}
          </Button>
          <StatutoryEditDialog employeeId={employeeId} bankIfsc={masked.bankIfsc} uan={masked.uan} esi={masked.esi} pf={masked.pf} pt={masked.pt} />
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <SField label="PAN" value={revealed ? revealed.pan : masked.panMasked} mono />
        <SField label="Aadhaar" value={revealed ? revealed.aadhaar : masked.aadhaarMasked} mono />
        <SField label="Bank account" value={revealed ? revealed.bankAccount : masked.bankAccountMasked} mono />
        <SField label="IFSC" value={masked.bankIfsc} mono />
        <SField label="UAN (PF)" value={masked.uan} />
        <SField label="ESI" value={masked.esi} />
        <SField label="PF number" value={masked.pf} />
        <SField label="PT" value={masked.pt} />
      </dl>

      <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
        PAN, Aadhaar and bank account are encrypted at rest. Reveal and edit actions are recorded in the audit log.
      </p>
    </div>
  );
}

function SField({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`mt-1 text-sm font-medium ${mono ? "numeric" : ""}`}>
        {value || <span className="font-sans text-muted-foreground/50">—</span>}
      </dd>
    </div>
  );
}

function StatutoryEditDialog({
  employeeId, bankIfsc, uan, esi, pf, pt,
}: {
  employeeId: string; bankIfsc: string | null; uan: string | null; esi: string | null; pf: string | null; pt: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // PAN/Aadhaar/account are write-only here — left blank means "leave unchanged".
  const [pan, setPan] = React.useState("");
  const [aadhaar, setAadhaar] = React.useState("");
  const [bankAccount, setBankAccount] = React.useState("");
  const [ifsc, setIfsc] = React.useState(bankIfsc ?? "");
  const [uanV, setUanV] = React.useState(uan ?? "");
  const [esiV, setEsiV] = React.useState(esi ?? "");
  const [pfV, setPfV] = React.useState(pf ?? "");
  const [ptV, setPtV] = React.useState(pt ?? "");

  async function save() {
    setError(null);
    setSaving(true);
    const res = await upsertStatutory(employeeId, {
      pan: pan.trim() || undefined,
      aadhaar: aadhaar.trim() || undefined,
      bankAccount: bankAccount.trim() || undefined,
      bankIfsc: ifsc.trim(),
      uan: uanV.trim(),
      esi: esiV.trim(),
      pf: pfV.trim(),
      pt: ptV.trim(),
    });
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    setPan(""); setAadhaar(""); setBankAccount("");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5"><Pencil className="size-3.5" /> Edit</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Statutory &amp; bank details</DialogTitle>
          <DialogDescription>
            Encrypted fields are write-only — leave PAN / Aadhaar / account blank to keep the current value.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2 sm:grid-cols-2">
          <EF label="PAN" value={pan} onChange={setPan} placeholder="ABCDE1234F" />
          <EF label="Aadhaar" value={aadhaar} onChange={setAadhaar} placeholder="12 digits" />
          <EF label="Bank account" value={bankAccount} onChange={setBankAccount} placeholder="Account number" />
          <EF label="IFSC" value={ifsc} onChange={setIfsc} placeholder="ABCD0123456" />
          <EF label="UAN (PF)" value={uanV} onChange={setUanV} />
          <EF label="ESI" value={esiV} onChange={setEsiV} />
          <EF label="PF number" value={pfV} onChange={setPfV} />
          <EF label="PT" value={ptV} onChange={setPtV} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
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

function EF({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12.5px]">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
