"use client";

// HR-only controls: upload/replace and remove the Employee Handbook.
// Rendered only when the viewer holds hr:write (server decides).

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2, Upload } from "lucide-react";

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
import { uploadHandbook, removeHandbook } from "@/actions/handbook.actions";

export function HandbookAdmin({ hasHandbook }: { hasHandbook: boolean }) {
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [pending, startTransition] = React.useTransition();
  const [removeOpen, setRemoveOpen] = React.useState(false);

  function onPick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are accepted.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      startTransition(async () => {
        const res = await uploadHandbook({
          fileName: file.name,
          dataUrl,
          name: file.name.replace(/\.pdf$/i, ""),
        });
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        toast.success(hasHandbook ? "Handbook replaced." : "Handbook published.");
        router.refresh();
      });
    };
    reader.onerror = () => toast.error(`Could not read "${file.name}".`);
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onRemove() {
    startTransition(async () => {
      const res = await removeHandbook();
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Handbook removed.");
      setRemoveOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
      />
      <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={pending}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        {hasHandbook ? "Replace PDF" : "Upload PDF"}
      </Button>
      {hasHandbook && (
        <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-destructive hover:text-destructive" disabled={pending}>
              <Trash2 className="size-3.5" />
              Remove
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove the Employee Handbook?</AlertDialogTitle>
              <AlertDialogDescription>
                Staff will no longer be able to read or download it until HR
                uploads a new edition. This cannot be undone — keep a copy of the
                PDF before removing.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  onRemove();
                }}
                disabled={pending}
              >
                {pending && <Loader2 className="size-3.5 animate-spin" />}
                Remove handbook
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
