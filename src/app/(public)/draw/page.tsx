import type { Metadata } from "next";
import { DrawForm } from "./_components/draw-form";

// QR-only public page — keep it out of search indexes.
export const metadata: Metadata = {
  title: "Veloria Grand — Guest Draw",
  robots: { index: false, follow: false },
};

export default function DrawPage() {
  return <DrawForm />;
}
