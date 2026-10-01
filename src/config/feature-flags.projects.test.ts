import { describe, expect, it } from "vitest";
import { sidebarNavigation, type NavItem } from "@/config/navigation";
import { PROJECTS_MODULE_ENABLED } from "@/config/feature-flags";

// Hiding a module means it is gone from every way IN, not just the sidebar.
// A stale entry is worse than no entry: it takes someone to a 404.
describe("Projects module visibility", () => {
  const flatten = (items: NavItem[]): { title: string; href?: string }[] =>
    items.flatMap((i) => [{ title: i.title, href: i.href }, ...(i.children ? flatten(i.children) : [])]);

  it("navigation matches the flag", () => {
    const projectHrefs = flatten(sidebarNavigation).filter((i) => i.href?.startsWith("/projects"));
    expect(projectHrefs.length > 0).toBe(PROJECTS_MODULE_ENABLED);
  });

  it("no navigation entry points at a hidden page", () => {
    if (PROJECTS_MODULE_ENABLED) return;
    for (const item of flatten(sidebarNavigation)) {
      expect(item.href ?? "").not.toMatch(/^\/projects/);
    }
  });
});
