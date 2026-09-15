import type { ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <main
      className={["page-shell", className].filter(Boolean).join(" ")}
      id="main-content"
      tabIndex={-1}
    >
      {children}
    </main>
  );
}
