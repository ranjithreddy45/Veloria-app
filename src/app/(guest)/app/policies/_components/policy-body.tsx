import { cn } from "@/lib/utils";
import { policyBlocks } from "../_lib/policy-blocks";

/**
 * A policy's text, rendered identically on the customer policy page and in
 * the team's preview (Settings → Customer content). Plain text only: every
 * block is escaped by React, nothing is parsed as HTML.
 */
export function PolicyBody({ body, className }: { body: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 text-body leading-[1.6] text-[#3a3a3c]", className)}>
      {policyBlocks(body).map((block, i) => {
        switch (block.kind) {
          case "heading":
            return (
              <h2 key={i} className="pt-1 text-copy font-semibold text-[#1d1d1f]">
                {block.text}
              </h2>
            );
          case "paragraph":
            return (
              <p key={i} className="whitespace-pre-line">
                {block.text}
              </p>
            );
          case "bullets":
            return (
              <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-[#6d1b52]">
                {block.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            );
          case "numbered":
            return (
              <ol key={i} start={block.start} className="list-decimal space-y-1.5 pl-5 marker:text-[#6d1b52]">
                {block.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ol>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
