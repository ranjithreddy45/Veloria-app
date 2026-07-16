# design-sync notes — VeloriaApp

- App repo, not a library: no dist. Converter runs in **synth-entry mode** — pass
  `--entry ./dist/index.js` (deliberately nonexistent) so `PKG_DIR` anchors at the
  repo root while `resolveDistEntry` falls through to synthesizing from
  `cfg.srcDir` (`src/components/ui`).
- Tailwind **v4**: no static compiled CSS in the repo. `cfg.buildCmd` compiles
  `.design-sync/tw-entry.css` (imports `src/app/globals.css`, `@source`s the ui
  components + authored previews) via `@tailwindcss/cli` installed in `.ds-sync/`.
  Re-run buildCmd before every converter run — previews add utility classes.
- Fonts: SF Pro / Cambria are OS fallback-stack fonts (design intent per
  globals.css: "Apple-first: native San Francisco, Inter elsewhere"); Inter and
  Geist Mono come from `next/font` at runtime. All suppressed via
  `runtimeFontPrefixes` — nothing shippable exists; system-font substitution IS
  the design.
- 178 PascalCase exports across 41 files: compound children (CardHeader,
  DialogTrigger, …) are `null`ed in `componentSrcMap` so the picker shows 41
  family cards; children remain importable from `window.VeloriaUI` (synth entry
  `export *`s every file). Groups come from `.design-sync/docs/<Name>.md`
  frontmatter stubs (Actions/Forms/Display/Overlays/Navigation).
- guidelinesGlob is [] on purpose: repo docs/ holds internal business docs (TEAM_AUDIT, agency blueprints), not design guidelines — never let the default glob ship them.
