import { FormSkeleton } from "@/components/shared/list-skeleton";

// The New Lead header has a one-line eyebrow and no actions; the form's
// section cards follow in a centred column.
export default function Loading() {
  return <FormSkeleton sections={2} />;
}
