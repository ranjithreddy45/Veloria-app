"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

/**
 * A credential sign-in performed through a Server Action may navigate with the
 * anonymous root layout still in the App Router cache. Re-read the session once
 * the protected shell mounts, then refresh server components so the header and
 * sidebar receive the same identity as the dashboard page.
 */
export function SessionRevalidator() {
  const { update } = useSession();
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    void update().finally(() => router.refresh());
  }, [router, update]);

  return null;
}
