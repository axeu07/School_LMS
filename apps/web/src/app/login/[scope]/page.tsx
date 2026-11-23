import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SignIn } from "@/features/auth/sign-in";
import type { AccountScope } from "@/services/auth-model";

const scopes = ["westfield", "harborview", "cedar", "platform"] as const;

type Props = { params: Promise<{ scope: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return scopes.map((scope) => ({ scope }));
}

export async function generateMetadata({ params }: Props) {
  const { scope } = await params;
  return {
    title:
      (scope === "platform" ? "Platform sign-in" : "Sign in") + " | ACADMAXIS",
  };
}

export default async function Page({ params }: Props) {
  const { scope } = await params;
  if (!scopes.includes(scope as AccountScope & (typeof scopes)[number]))
    notFound();
  return (
    <Suspense
      fallback={<main className="route-message">Loading sign-in…</main>}
    >
      <SignIn scope={scope as AccountScope} />
    </Suspense>
  );
}
