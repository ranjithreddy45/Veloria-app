import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_PREFIXES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

/**
 * Expire current and legacy Auth.js session cookies before the normal sign-out
 * request. The legacy names matter after a deployment changed from an HTTP or
 * localhost AUTH_URL to HTTPS: Auth.js then signs out of the current secure
 * cookie but an older cookie can otherwise authenticate the next refresh.
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const names = new Set(AUTH_COOKIE_PREFIXES);

  for (const { name } of request.cookies.getAll()) {
    if (AUTH_COOKIE_PREFIXES.some((prefix) => name.startsWith(`${prefix}.`))) {
      names.add(name);
    }
  }

  for (const name of names) {
    response.cookies.set({
      name,
      value: "",
      expires: new Date(0),
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: name.startsWith("__Secure-"),
    });
  }

  return response;
}
