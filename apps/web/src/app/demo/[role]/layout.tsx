import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { RoleShell } from "@/features/demo/role-shell";
import { demoRoles, type DemoRole } from "@/types/demo";

export const dynamicParams = false;

export function generateStaticParams() {
  return demoRoles.map((role) => ({ role }));
}

export default async function RoleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ role: string }>;
}) {
  const { role } = await params;
  if (!demoRoles.includes(role as DemoRole)) notFound();
  return (
    <RoleShell key={role} role={role as DemoRole}>
      {children}
    </RoleShell>
  );
}
