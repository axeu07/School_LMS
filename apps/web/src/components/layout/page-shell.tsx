import type { ReactNode } from "react";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-12 sm:px-8">
      {children}
    </main>
  );
}
