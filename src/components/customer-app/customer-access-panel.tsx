"use client";

// ============================================================
// Customer app access for one contact (team side).
// Who can sign in to the customer app and see this contact's bookings,
// payments and documents. "Give access by phone" and "Remove access" write
// through src/actions/customer-access.actions.ts, which logs every change.
// Renders nothing for roles without contacts:update or bookings:update.
// Mount: <CustomerAccessPanel contactId={contact.id} />
// ============================================================

import * as React from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  getCustomerAccess,
  grantCustomerAccessByPhone,
  removeCustomerAccess,
  type CustomerAccessData,
  type CustomerAccessLogin,
} from "@/actions/customer-access.actions";

const METHOD_LABEL: Record<string, string> = {
  PHONE: "WhatsApp code",
  STAFF: "Added by team",
  EMAIL: "Verified email",
  VERIFIED_EMAIL: "Verified email",
};

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

/** Client-side twin of normalizeOtpPhone (src/lib/otp.ts), for display and the mismatch hint. */
function phoneKey(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length === 10) d = "91" + d;
  else if (d.length === 11 && d.startsWith("0")) d = "91" + d.slice(1);
  return d;
}

function formatPhone(raw: string | null): string {
  if (!raw?.trim()) return "No phone on this login";
  const d = phoneKey(raw);
  if (d.length === 12 && d.startsWith("91")) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  return d ? `+${d}` : raw;
}

export function CustomerAccessPanel({ contactId }: { contactId: string }) {
  const [data, setData] = React.useState<CustomerAccessData | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "hidden" | "error">("loading");
  const [loadError, setLoadError] = React.useState("");
  const [grantOpen, setGrantOpen] = React.useState(false);
  const [phone, setPhone] = React.useState("");
  const [granting, setGranting] = React.useState(false);
  const [removing, setRemoving] = React.useState<CustomerAccessLogin | null>(null);
  const [removeBusy, setRemoveBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await getCustomerAccess(contactId);
      if (res.success) {
        setData(res.data);
        setStatus("ready");
      } else if (res.forbidden) {
        setStatus("hidden");
      } else {
        setLoadError(res.error);
        setStatus("error");
      }
    } catch {
      setLoadError("Couldn't load customer access. Please refresh the page.");
      setStatus("error");
    }
  }, [contactId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function openGrant() {
    setPhone(data?.contactPhones[0] ?? "");
    setGrantOpen(true);
  }

  async function grant() {
    setGranting(true);
    try {
      const res = await grantCustomerAccessByPhone({ contactId, phone });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.data.alreadyHadAccess
          ? "That number already has access to this contact."
          : res.data.newLogin
            ? "Access given. A customer login was created for this number."
            : "Access given to the existing customer login for this number."
      );
      setGrantOpen(false);
      await load();
    } catch {
      toast.error("Couldn't give access. Please try again.");
    } finally {
      setGranting(false);
    }
  }

  async function remove() {
    if (!removing?.linkId) return;
    setRemoveBusy(true);
    try {
      const res = await removeCustomerAccess({ contactId, linkId: removing.linkId });
      if (!res.success) toast.error(res.error);
      else toast.success("Access removed.");
      setRemoving(null);
      await load();
    } catch {
      toast.error("Couldn't remove access. Please try again.");
    } finally {
      setRemoveBusy(false);
    }
  }

  if (status === "hidden") return null;

  const typedKey = phoneKey(phone);
  const recordKeys = (data?.contactPhones ?? []).map(phoneKey);
  const notOnRecord = typedKey.length >= 11 && recordKeys.length > 0 && !recordKeys.includes(typedKey);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4" aria-hidden />
            Customer app access
          </CardTitle>
          <CardDescription>
            People who can sign in to the customer app and see this contact&rsquo;s bookings, payments and
            documents.
          </CardDescription>
        </div>
        {status === "ready" && (
          <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={openGrant}>
            <Plus className="size-4" aria-hidden />
            Give access by phone
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {status === "loading" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading customer access…
          </div>
        )}
        {status === "error" && <p className="text-sm text-destructive">{loadError}</p>}
        {status === "ready" && data && data.logins.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No logins yet. If this contact&rsquo;s number isn&rsquo;t on any other contact, the customer can sign in
            with a WhatsApp code once there&rsquo;s a booking, lead or quotation. You can also give access by phone.
          </p>
        )}
        {status === "ready" && data && data.logins.length > 0 && (
          <ul className="divide-y">
            {data.logins.map((login) => (
              <li
                key={login.linkId ?? `email-${login.userId}`}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{login.name || "Unnamed login"}</span>
                    <Badge variant={login.method === "STAFF" ? "secondary" : "outline"}>
                      {METHOD_LABEL[login.method] ?? login.method}
                    </Badge>
                    {!login.isActive && <Badge variant="warning">Login switched off</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatPhone(login.phone)}
                    {login.email ? ` · ${login.email}` : ""}
                    {login.verifiedAt
                      ? ` · ${login.method === "VERIFIED_EMAIL" ? "email verified" : "since"} ${dateFormat.format(new Date(login.verifiedAt))}`
                      : ""}
                  </div>
                </div>
                {login.linkId ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setRemoving(login)}
                  >
                    Remove access
                  </Button>
                ) : (
                  <span className="max-w-xs text-xs text-muted-foreground">
                    Through a verified email that matches this contact. Change the contact&rsquo;s email to stop it.
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={grantOpen} onOpenChange={(open) => !granting && setGrantOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Give customer app access</DialogTitle>
            <DialogDescription>
              Whoever holds this WhatsApp number will see this contact&rsquo;s bookings, payments and documents after
              signing in with a code sent to it.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void grant();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="customer-access-phone">Mobile number</Label>
              <Input
                id="customer-access-phone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoFocus
              />
              {notOnRecord && (
                <p className="text-xs font-medium text-warning">
                  This number isn&rsquo;t on the contact record. Double-check it before giving access.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setGrantOpen(false)} disabled={granting}>
                Cancel
              </Button>
              <Button type="submit" disabled={granting || phone.replace(/\D/g, "").length < 10}>
                {granting && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
                Give access
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!removing}
        onOpenChange={(open) => {
          if (!open && !removeBusy) setRemoving(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove customer app access?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.name || "This login"} will stop seeing this contact&rsquo;s bookings, payments and documents
              straight away. Signing in again with a WhatsApp code won&rsquo;t bring it back; only Give access by phone
              will. Invitations a host sent them to a specific event are separate and stay as they are.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeBusy}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
            >
              {removeBusy && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
              Remove access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
