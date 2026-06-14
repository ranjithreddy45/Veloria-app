import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvestorPackButton({ fy }: { fy?: string }) {
  const href = `/api/finance/investor-pack${fy ? `?fy=${encodeURIComponent(fy)}` : ""}`;
  return (
    <Button asChild variant="outline" className="border-[#C9A96E] text-[#2D1B3D]">
      <a href={href} target="_blank" rel="noopener noreferrer">
        <FileText className="mr-2 h-4 w-4" />
        Board / Investor Pack
      </a>
    </Button>
  );
}
