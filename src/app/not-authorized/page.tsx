import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Not Authorized" };

export default function NotAuthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex max-w-md flex-col items-center gap-6 px-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30">
          <ShieldAlert className="size-8 text-red-500" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Access Denied
          </h1>
          <p className="text-sm text-muted-foreground">
            You don&apos;t have permission to access this page. Please contact
            your administrator if you believe this is an error.
          </p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 size-4" />
              Go to Dashboard
            </Link>
          </Button>
          <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
            <Link href="/sign-in">Sign In</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
