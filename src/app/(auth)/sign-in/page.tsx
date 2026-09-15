import type { Metadata } from "next";
import SignInForm from "./_components/sign-in-form";

export const metadata: Metadata = { title: "Sign In" };
// Read the provider settings when the page is requested, so adding the Google
// keys takes effect on the next restart without a rebuild.
export const dynamic = "force-dynamic";

export default function SignInPage() {
  // Without both keys the button sends people to Google's
  // "Access blocked: Missing required parameter: client_id" page.
  const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID?.trim() && process.env.AUTH_GOOGLE_SECRET?.trim());
  return <SignInForm googleEnabled={googleEnabled} />;
}
