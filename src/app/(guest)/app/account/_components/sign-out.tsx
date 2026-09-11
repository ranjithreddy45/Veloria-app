"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button type="button" onClick={() => signOut({ callbackUrl: "/app/welcome" })} className="py-2 text-center text-body font-semibold text-[#ff3b30]">
      Sign out
    </button>
  );
}
