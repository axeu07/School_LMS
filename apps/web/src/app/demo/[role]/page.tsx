import { RoleOverview } from "@/features/demo/overview";
import { roleProfiles } from "@/mocks/academics";
import { roleHidden } from "@/features/preschool/config";
import { demoRoles, type DemoRole } from "@/types/demo";

type Props = { params: Promise<{ role: string }> };

export function generateStaticParams() {
  return demoRoles
    .filter((role) => !roleHidden(role))
    .map((role) => ({ role }));
}

export async function generateMetadata({ params }: Props) {
  const { role } = await params;
  if (!demoRoles.includes(role as DemoRole)) return {};
  return {
    title: roleProfiles[role as DemoRole].label + " Dashboard | ACADMAXIS",
  };
}

export default function Page() {
  return <RoleOverview />;
}
