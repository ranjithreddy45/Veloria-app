"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CameraIcon,
  FileTextIcon,
  ShieldCheckIcon,
  Loader2Icon,
  PlusIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { addTaskProof } from "@/actions/execution-task.actions";

interface ProofUploadProps {
  taskId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  existingProofs?: any[];
}

const PROOF_TYPE_OPTIONS = [
  { value: "PHOTO", label: "Photo", icon: CameraIcon },
  { value: "NOTE", label: "Note", icon: FileTextIcon },
  { value: "SIGN_OFF", label: "Sign-off", icon: ShieldCheckIcon },
];

export function ProofUpload({ taskId, existingProofs = [] }: ProofUploadProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [proofType, setProofType] = useState("PHOTO");
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState("");

  function handleSubmit() {
    if (!content.trim()) {
      toast.error(
        proofType === "PHOTO"
          ? "Please provide a photo URL."
          : "Please provide content."
      );
      return;
    }

    startTransition(async () => {
      const result = await addTaskProof(taskId, {
        type: proofType as "PHOTO" | "NOTE" | "SIGN_OFF",
        content: content.trim(),
        notes: notes.trim() || undefined,
      });

      if (result.success) {
        toast.success("Proof added successfully.");
        setOpen(false);
        setContent("");
        setNotes("");
        setProofType("PHOTO");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to add proof.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* Existing Proofs */}
      {existingProofs.length > 0 && (
        <div className="space-y-2">
          {existingProofs.map((proof) => (
            <div
              key={proof.id}
              className="flex items-start gap-2 rounded-md border border-border p-2 text-sm"
            >
              <span className="shrink-0 mt-0.5">
                {proof.type === "PHOTO" && (
                  <CameraIcon className="size-3.5 text-blue-500" />
                )}
                {proof.type === "NOTE" && (
                  <FileTextIcon className="size-3.5 text-success" />
                )}
                {proof.type === "SIGN_OFF" && (
                  <ShieldCheckIcon className="size-3.5 text-violet-500" />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">
                  {proof.type === "PHOTO" ? "Photo" : proof.type === "NOTE" ? "Note" : "Sign-off"}
                </p>
                {proof.type === "PHOTO" ? (
                  <a
                    href={proof.content}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline truncate block"
                  >
                    {proof.content}
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {proof.content}
                  </p>
                )}
                {proof.notes && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Note: {proof.notes}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Proof Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full">
            <PlusIcon className="mr-1.5 size-3.5" />
            Add Proof
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Task Proof</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Proof Type</label>
              <Select value={proofType} onValueChange={setProofType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROOF_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <opt.icon className="size-3.5" />
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {proofType === "PHOTO"
                  ? "Photo URL"
                  : proofType === "NOTE"
                    ? "Note Content"
                    : "Sign-off Details"}
                <span className="text-destructive ml-0.5">*</span>
              </label>
              {proofType === "PHOTO" ? (
                <Input
                  placeholder="https://example.com/photo.jpg"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              ) : (
                <Textarea
                  placeholder={
                    proofType === "NOTE"
                      ? "Enter your notes..."
                      : "Enter sign-off details..."
                  }
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={3}
                />
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Additional Notes</label>
              <Textarea
                placeholder="Optional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending && (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              )}
              Add Proof
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
