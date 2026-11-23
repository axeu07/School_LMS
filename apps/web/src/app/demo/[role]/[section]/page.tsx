import { notFound } from "next/navigation";
import { findNavItem, navItems } from "@/features/demo/navigation";
import { SectionPage } from "@/features/demo/section-page";
import { roleProfiles } from "@/mocks/academics";
import { demoRoles, type DemoRole } from "@/types/demo";

type Props = { params: Promise<{ role: string; section: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return demoRoles.flatMap((role) =>
    navItems(role)
      .filter((entry) => entry.slug)
      .map((entry) => ({ role, section: entry.slug })),
  );
}

function resolve(role: string, section: string) {
  if (!demoRoles.includes(role as DemoRole)) return;
  return findNavItem(role as DemoRole, section);
}

export async function generateMetadata({ params }: Props) {
  const { role, section } = await params;
  const entry = resolve(role, section);
  if (!entry) return {};
  return {
    title:
      entry.title +
      " · " +
      roleProfiles[role as DemoRole].label +
      " | ACADMAXIS",
    description: entry.description,
  };
}

export default async function Page({ params }: Props) {
  const { role, section } = await params;
  if (!section || !resolve(role, section)) notFound();
  return <SectionPage slug={section} />;
}
