// Bare layout for print/PDF pages: only the root <html><body> wraps these —
// NO dashboard sidebar/header, NO width constraints. The page renders its own
// document content full-width so saving as PDF is clean.
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
