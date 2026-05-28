"use client";

import * as React from "react";
import { toast } from "sonner";
import { Database, Loader2 } from "lucide-react";
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
import { loadSampleData } from "@/actions/sample-data.actions";

/**
 * Admin-only button that triggers `loadSampleData()` server action.
 * Confirms before running because the seed adds dozens of rows
 * across contacts, leads, calls, and integration configs.
 */
export function LoadSampleDataButton() {
  const [loading, setLoading] = React.useState(false);

  async function handleLoad() {
    setLoading(true);
    try {
      const result = await loadSampleData();
      if (result.success) {
        toast.success(result.message ?? "Sample data loaded");
      } else {
        toast.error(result.error ?? "Failed to load sample data");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading}>
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Database className="size-3.5" />
          )}
          {loading ? "Loading…" : "Load sample data"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Load sample demo data?</AlertDialogTitle>
          <AlertDialogDescription>
            Inserts ~12 contacts, 12 leads from various sources, 10 call logs
            (some with recordings), and demo integration configs. Safe to run
            multiple times — it&apos;s additive. Not for production use.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleLoad}>
            Load demo data
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
