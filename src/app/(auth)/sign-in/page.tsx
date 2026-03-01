import type { Metadata } from "next";
import SignInForm from "./_components/sign-in-form";

export const metadata: Metadata = { title: "Sign In" };

export default function SignInPage() {
  return <SignInForm />;
}
