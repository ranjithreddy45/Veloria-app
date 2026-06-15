"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  FileTextIcon,
  UtensilsCrossedIcon,
  Loader2Icon,
  FileSignatureIcon,
  ShoppingCartIcon,
  TruckIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { createBeo } from "@/actions/beo.actions";
import { createKitchenPlan } from "@/actions/kitchen.actions";

// ============================================================
// Booking → Event Operations quick links
// One-click create (or open) the day-of-event documents tied to a booking:
// the Function Sheet (BEO) and the Kitchen Plan. Covers default to the
// booking's guest count. Shows "View" when a record already exists so we
// don't create duplicates.
// ============================================================

interface Props {
  bookingId: string;
  covers: number;
  beoId: string | null;
  kitchenPlanId: string | null;
  contractId: string | null;
}

export function BookingOpsLinks({ bookingId, covers, beoId, kitchenPlanId, contractId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "beo" | "kitchen">(null);

  async function makeBeo() {
    setBusy("beo");
    try {
      const res = await createBeo({ bookingId, covers });
      if (res.success) {
        toast.success("Function sheet created");
        router.push(`/beo/${res.data.id}`);
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Failed to create function sheet");
    } finally {
      setBusy(null);
    }
  }

  async function makeKitchen() {
    setBusy("kitchen");
    try {
      const res = await createKitchenPlan({ bookingId, covers });
      if (res.success) {
        toast.success("Kitchen plan created");
        router.push(`/kitchen/${res.data.id}`);
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Failed to create kitchen plan");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {beoId ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/beo/${beoId}`}>
            <FileTextIcon className="mr-1.5 size-4" />
            Function Sheet
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={makeBeo} disabled={busy !== null}>
          {busy === "beo" ? (
            <Loader2Icon className="mr-1.5 size-4 animate-spin" />
          ) : (
            <FileTextIcon className="mr-1.5 size-4" />
          )}
          Create Function Sheet
        </Button>
      )}

      {kitchenPlanId ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/kitchen/${kitchenPlanId}`}>
            <UtensilsCrossedIcon className="mr-1.5 size-4" />
            Kitchen Plan
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={makeKitchen} disabled={busy !== null}>
          {busy === "kitchen" ? (
            <Loader2Icon className="mr-1.5 size-4 animate-spin" />
          ) : (
            <UtensilsCrossedIcon className="mr-1.5 size-4" />
          )}
          Create Kitchen Plan
        </Button>
      )}

      {contractId ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/contracts/${contractId}`}>
            <FileSignatureIcon className="mr-1.5 size-4" />
            Contract
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/contracts/new?bookingId=${bookingId}`}>
            <FileSignatureIcon className="mr-1.5 size-4" />
            Create Contract
          </Link>
        </Button>
      )}

      <Button variant="outline" size="sm" asChild>
        <Link href={`/procurement?bookingId=${bookingId}`}>
          <ShoppingCartIcon className="mr-1.5 size-4" />
          Raise Procurement
        </Link>
      </Button>

      <Button variant="outline" size="sm" asChild>
        <Link href={`/logistics?bookingId=${bookingId}`}>
          <TruckIcon className="mr-1.5 size-4" />
          Create Dispatch
        </Link>
      </Button>
    </>
  );
}
