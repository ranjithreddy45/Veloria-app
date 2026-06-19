"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createFranchisePartner } from "@/actions/franchise.actions";

// ============================================================
// Onboarding entry — create a DRAFT partner, then jump to the wizard.
// Gated by franchise:onboard (middleware + ROUTE_PERMISSIONS /franchise).
// ============================================================

export default function NewFranchisePartnerPage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [contactPhone, setContactPhone] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 1) {
      toast.error("Partner name is required");
      return;
    }
    setSubmitting(true);
    try {
      const result = await createFranchisePartner({
        name: name.trim(),
        contactEmail: contactEmail.trim() || null,
        contactPhone: contactPhone.trim() || null,
        status: "DRAFT",
      });
      if (result.success) {
        toast.success("Partner created — let's onboard them.");
        router.push(`/franchise/${result.data.id}?tab=onboarding`);
      } else {
        toast.error(result.error ?? "Failed to create partner");
        setSubmitting(false);
      }
    } catch {
      toast.error("Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Franchise Partner"
        description="Create the partner record, then complete the onboarding wizard."
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Partner identity</CardTitle>
          <CardDescription>
            Just the basics to get started — KYC, bank and venues come next in
            the wizard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Partner name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sunrise Hospitality LLP"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="email">Contact email</Label>
                <Input
                  id="email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="owner@partner.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Contact phone</Label>
                <Input
                  id="phone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+91…"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                Create &amp; start onboarding
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/franchise")}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
