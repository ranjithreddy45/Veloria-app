"use client";

import { signOut } from "next-auth/react";

/** Clear any legacy session cookies before completing the Auth.js sign-out. */
export async function signOutSafely(callbackUrl = "/sign-in") {
  try {
    await fetch("/api/auth/clear-session", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    });
  } finally {
    await signOut({ callbackUrl });
  }
}
