import { Loader2 } from "lucide-react";

export default function AuthLoading() {
  return (
    <div className="bg-auth-mesh flex min-h-screen items-center justify-center">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  );
}
