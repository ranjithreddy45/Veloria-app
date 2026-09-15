"use client";

// ============================================================
// Two-factor authentication card — enrol, show recovery codes once,
// regenerate recovery codes, disable. All mutations go through
// src/actions/two-factor.actions.ts and require a current code.
// ============================================================

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Download,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Smartphone,
} from "lucide-react";
import {
  confirmTwoFactorSetup,
  disableTwoFactor,
  regenerateRecoveryCodes,
  startTwoFactorSetup,
} from "@/actions/two-factor.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface TwoFactorInitialStatus {
  enabled: boolean;
  enabledAt: string | null;
  lastUsedAt: string | null;
  recoveryCodesLeft: number;
  required: boolean;
}

interface SetupData {
  qrDataUrl: string;
  manualKey: string;
  issuer: string;
  account: string;
}

type CodeDialog = "disable" | "regenerate" | null;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TwoFactorSettings({
  initialStatus,
  accountEmail,
}: {
  initialStatus: TwoFactorInitialStatus;
  accountEmail: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [status, setStatus] = useState(initialStatus);
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [codeDialog, setCodeDialog] = useState<CodeDialog>(null);
  const [dialogCode, setDialogCode] = useState("");
  const [copied, setCopied] = useState(false);

  // ---------------------------------------------------------- enrolment
  function handleStartSetup() {
    startTransition(async () => {
      const result = await startTwoFactorSetup();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSetup(result.data);
      setSetupCode("");
    });
  }

  function handleConfirmSetup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = setupCode.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(code)) {
      toast.error("Enter the 6-digit code shown in your authenticator app.");
      return;
    }
    startTransition(async () => {
      const result = await confirmTwoFactorSetup(code);
      if (!result.success) {
        setSetupCode("");
        toast.error(result.error);
        return;
      }
      setSetup(null);
      setSetupCode("");
      setRecoveryCodes(result.data.recoveryCodes);
      setStatus((s) => ({
        ...s,
        enabled: true,
        enabledAt: new Date().toISOString(),
        recoveryCodesLeft: result.data.recoveryCodes.length,
      }));
      toast.success("Two-factor authentication is on.");
      router.refresh();
    });
  }

  // ------------------------------------------------ disable / regenerate
  function handleCodeDialogSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = dialogCode.trim();
    if (!code) {
      toast.error("Enter a current authenticator or recovery code.");
      return;
    }
    const which = codeDialog;
    startTransition(async () => {
      if (which === "disable") {
        const result = await disableTwoFactor(code);
        if (!result.success) {
          setDialogCode("");
          toast.error(result.error);
          return;
        }
        setCodeDialog(null);
        setDialogCode("");
        setRecoveryCodes(null);
        setStatus((s) => ({
          ...s,
          enabled: false,
          enabledAt: null,
          lastUsedAt: null,
          recoveryCodesLeft: 0,
        }));
        toast.success("Two-factor authentication is off.");
        router.refresh();
        return;
      }
      if (which === "regenerate") {
        const result = await regenerateRecoveryCodes(code);
        if (!result.success) {
          setDialogCode("");
          toast.error(result.error);
          return;
        }
        setCodeDialog(null);
        setDialogCode("");
        setRecoveryCodes(result.data.recoveryCodes);
        setStatus((s) => ({ ...s, recoveryCodesLeft: result.data.recoveryCodes.length }));
        toast.success("New recovery codes generated — the old ones no longer work.");
      }
    });
  }

  // ------------------------------------------------------ recovery codes
  async function copyRecoveryCodes() {
    if (!recoveryCodes) return;
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Recovery codes copied.");
    } catch {
      toast.error("Couldn't copy — select the codes and copy them manually.");
    }
  }

  function downloadRecoveryCodes() {
    if (!recoveryCodes) return;
    const body = [
      "Veloria Grand — two-factor recovery codes",
      `Account: ${accountEmail}`,
      `Generated: ${new Date().toLocaleString("en-IN")}`,
      "",
      "Each code works once. Keep this file somewhere safe and private.",
      "",
      ...recoveryCodes,
      "",
    ].join("\n");
    const blob = new Blob([body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "veloria-grand-recovery-codes.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------ status card */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              Two-factor authentication
            </CardTitle>
            {status.enabled ? (
              <Badge variant="success">On</Badge>
            ) : (
              <Badge variant="secondary">Off</Badge>
            )}
            {status.required && !status.enabled ? (
              <Badge variant="warning">Required for your role</Badge>
            ) : null}
          </div>
          <CardDescription>
            After your password, you&apos;ll be asked for a 6-digit code from
            an authenticator app on your phone. Signing in with Google or a
            WhatsApp code asks for it too.
          </CardDescription>
        </CardHeader>

        {status.enabled ? (
          <>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-meta uppercase tracking-wide text-muted-foreground">
                    Enabled on
                  </dt>
                  <dd className="text-body font-medium">{formatDate(status.enabledAt)}</dd>
                </div>
                <div>
                  <dt className="text-meta uppercase tracking-wide text-muted-foreground">
                    Last used
                  </dt>
                  <dd className="text-body font-medium">{formatDate(status.lastUsedAt)}</dd>
                </div>
                <div>
                  <dt className="text-meta uppercase tracking-wide text-muted-foreground">
                    Recovery codes left
                  </dt>
                  <dd className="text-body font-medium">
                    {status.recoveryCodesLeft}
                    {status.recoveryCodesLeft <= 2 ? (
                      <span className="ml-2 text-meta font-normal text-amber-600 dark:text-amber-400">
                        Running low — regenerate soon
                      </span>
                    ) : null}
                  </dd>
                </div>
              </dl>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  setDialogCode("");
                  setCodeDialog("regenerate");
                }}
              >
                <RefreshCw className="size-3.5" />
                Regenerate recovery codes
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  setDialogCode("");
                  setCodeDialog("disable");
                }}
              >
                <ShieldOff className="size-3.5" />
                Turn off
              </Button>
            </CardFooter>
          </>
        ) : setup ? (
          <form onSubmit={handleConfirmSetup}>
            <CardContent className="space-y-5">
              <ol className="grid gap-5 md:grid-cols-[auto_1fr] md:items-start">
                <li className="flex flex-col items-center gap-2">
                  <div className="rounded-xl border border-border bg-white p-2">
                    <Image
                      src={setup.qrDataUrl}
                      alt="QR code for your authenticator app"
                      width={224}
                      height={224}
                      unoptimized
                      className="size-[224px]"
                    />
                  </div>
                  <p className="text-meta text-muted-foreground">
                    {setup.issuer} · {setup.account}
                  </p>
                </li>
                <li className="space-y-4">
                  <div className="space-y-1">
                    <p className="flex items-center gap-2 text-body font-medium">
                      <Smartphone className="size-4 text-primary" />
                      1. Scan the QR code
                    </p>
                    <p className="text-detail text-muted-foreground">
                      Open Google Authenticator, Microsoft Authenticator, Authy,
                      1Password or any TOTP app and add an account by scanning.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-detail font-medium">
                      Can&apos;t scan? Enter this key by hand
                    </p>
                    <code className="block select-all rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-detail tracking-wider">
                      {setup.manualKey}
                    </code>
                    <p className="text-meta text-muted-foreground">
                      Time-based · 6 digits · 30 seconds
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="setup-code" className="text-body font-medium">
                      2. Enter the code the app shows
                    </Label>
                    <Input
                      id="setup-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      maxLength={7}
                      autoFocus
                      className="h-11 max-w-[220px] text-center text-lede font-semibold tracking-[0.35em]"
                      value={setupCode}
                      onChange={(e) => setSetupCode(e.target.value.replace(/[^\d\s]/g, ""))}
                      disabled={isPending}
                    />
                  </div>
                </li>
              </ol>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                Verify &amp; turn on
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={isPending}
                onClick={() => {
                  setSetup(null);
                  setSetupCode("");
                }}
              >
                Cancel
              </Button>
            </CardFooter>
          </form>
        ) : (
          <>
            <CardContent>
              <ul className="grid gap-2 text-detail text-muted-foreground sm:grid-cols-3">
                <li className="flex items-start gap-2">
                  <Smartphone className="mt-0.5 size-4 shrink-0 text-primary" />
                  Works with any authenticator app — no SMS needed.
                </li>
                <li className="flex items-start gap-2">
                  <KeyRound className="mt-0.5 size-4 shrink-0 text-primary" />
                  You get 8 one-time recovery codes in case you lose your phone.
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                  A stolen password alone can no longer open your account.
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button onClick={handleStartSetup} disabled={isPending}>
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                Start setup
              </Button>
            </CardFooter>
          </>
        )}
      </Card>

      {/* ------------------------------------------- recovery codes (once) */}
      {recoveryCodes ? (
        <Card className="border-amber-300/60 dark:border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-amber-600 dark:text-amber-400" />
              Save your recovery codes
            </CardTitle>
            <CardDescription>
              This is the only time these codes are shown. Each one signs you
              in once if you lose access to your authenticator app. Store them
              somewhere safe — a password manager is ideal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {recoveryCodes.map((code) => (
                <li
                  key={code}
                  className="select-all rounded-md border border-border bg-muted/50 px-3 py-2 text-center font-mono text-detail tracking-wider"
                >
                  {code}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={copyRecoveryCodes}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button variant="outline" size="sm" onClick={downloadRecoveryCodes}>
              <Download className="size-3.5" />
              Download .txt
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setRecoveryCodes(null)}
            >
              I&apos;ve saved them
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {/* ------------------------------------- code prompt (disable/regen) */}
      <Dialog
        open={codeDialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCodeDialog(null);
            setDialogCode("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCodeDialogSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {codeDialog === "disable"
                  ? "Turn off two-factor authentication?"
                  : "Regenerate recovery codes"}
              </DialogTitle>
              <DialogDescription>
                {codeDialog === "disable"
                  ? "Your account will be protected by your password alone. Confirm with a current authenticator code or a recovery code."
                  : "All existing recovery codes stop working and 8 new ones are issued. Confirm with a current authenticator code or a recovery code."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="dialog-code" className="text-detail font-medium">
                Authentication code
              </Label>
              <Input
                id="dialog-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={12}
                autoFocus
                className="h-11 text-center text-lede font-semibold tracking-[0.35em]"
                value={dialogCode}
                onChange={(e) => setDialogCode(e.target.value.toUpperCase())}
                disabled={isPending}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={isPending}
                onClick={() => {
                  setCodeDialog(null);
                  setDialogCode("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={codeDialog === "disable" ? "destructive" : "default"}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {codeDialog === "disable" ? "Turn off" : "Generate new codes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
