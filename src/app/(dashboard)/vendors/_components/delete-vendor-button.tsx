"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteVendor } from "@/actions/vendor-catalog.actions";

export function DeleteVendorButton({ vendorId, vendorName }: { vendorId: string; vendorName: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);

  function run() {
    startTransition(async () => {
      const res = await deleteVendor(vendorId);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`Vendor "${vendorName}" deleted.`);
      setOpen(false);
      router.push("/vendors");
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-destructive hover:text-destructive">
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{vendorName}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the vendor and all of its packages. A vendor
            with booking, payout or bid history can&rsquo;t be deleted — archive it
            instead to keep those records intact. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              run();
            }}
            disabled={pending}
          >
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            Delete vendor
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
