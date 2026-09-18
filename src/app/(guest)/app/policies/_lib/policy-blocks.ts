// ============================================================
// Policy text → display blocks. Pure, so the customer policy page and the
// team's preview render a policy identically.
//
// The team writes plain text: a blank line starts a new paragraph, "- " (or
// "* ", "• ") makes a bullet, "1. " a numbered item, "# " a heading. Nothing
// is interpreted as HTML — every block is rendered as escaped text.
// ============================================================

export type PolicyBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "numbered"; items: string[]; start: number };

export function policyBlocks(body: string | null | undefined): PolicyBlock[] {
  const blocks: PolicyBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", text: paragraph.join("\n") });
      paragraph = [];
    }
  };

  for (const raw of (body ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = /^#{1,3}\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: "heading", text: heading[1].trim() });
      continue;
    }
    const bullet = /^[-*•]\s+(.+)$/.exec(line);
    if (bullet) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last?.kind === "bullets") last.items.push(bullet[1].trim());
      else blocks.push({ kind: "bullets", items: [bullet[1].trim()] });
      continue;
    }
    const numbered = /^(\d{1,3})[.)]\s+(.+)$/.exec(line);
    if (numbered) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last?.kind === "numbered") last.items.push(numbered[2].trim());
      else blocks.push({ kind: "numbered", items: [numbered[2].trim()], start: Number(numbered[1]) });
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return blocks;
}
