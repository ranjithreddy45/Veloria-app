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
import { deletePackage } from "@/actions/vendor-catalog.actions";

export function DeletePackageButton({ packageId, packageName }: { packageId: string; packageName: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);

  function run() {
    startTransition(async () => {
      const res = await deletePackage(packageId);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`Package "${packageName}" deleted.`);
      setOpen(false);
      router.push("/vendors");
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 text-body text-destructive hover:text-destructive">
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{packageName}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the package with its sections, items and
            images. Quotations that already froze this package keep their own
            snapshot; draft quotes will show it as no longer available. This
            cannot be undone — archive it instead if you may want it back.
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
            Delete package
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
