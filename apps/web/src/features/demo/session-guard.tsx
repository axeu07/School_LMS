"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import {
  sessionExpired,
  sessionTimeoutMinutes,
  signOut,
  touchSession,
  type Session,
} from "@/services/auth-model";
import { updateAuthState, useAuthState } from "@/services/auth-store";
import { logAudit } from "@/services/audit-store";
import { useNow } from "@/services/learning-store";
import type { DemoRole, SchoolId } from "@/types/demo";
import { formatCountdown } from "./format";

/** The signed-in session for this workspace, or null in demo mode. */
export function useWorkspaceSession(role: DemoRole, school: SchoolId) {
  const { session } = useAuthState();
  if (!session || session.role !== role) return null;
  const scope = role === "super-admin" ? "platform" : school;
  return session.school === scope ? session : null;
}

export function signOutTo(
  router: ReturnType<typeof useRouter>,
  session: Session,
  reason: "signedOut" | "expired",
) {
  logAudit(
    session.school,
    "Access",
    reason === "expired" ? "Signed out after inactivity" : "Signed out",
    session.name,
    { role: session.role, name: session.name },
  );
  updateAuthState(signOut);
  router.replace("/login/" + session.school + "?" + reason + "=1");
}

/**
 * Tracks activity for a signed-in session, warns a minute before the idle
 * timeout and signs out when it passes.
 */
export function SessionGuard({
  role,
  school,
}: {
  role: DemoRole;
  school: SchoolId;
}) {
  const session = useWorkspaceSession(role, school);
  const router = useRouter();
  const now = useNow(1000);
  const dialog = useRef<HTMLDialogElement>(null);
  const account = session?.account;

  useEffect(() => {
    if (!account) return;
    let last = 0;
    const activity = () => {
      const time = Date.now();
      if (time - last < 20_000) return;
      last = time;
      updateAuthState((state) => touchSession(state, new Date(time)));
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((name) =>
      window.addEventListener(name, activity, { passive: true }),
    );
    return () =>
      events.forEach((name) => window.removeEventListener(name, activity));
  }, [account]);

  const remaining =
    session && now
      ? sessionTimeoutMinutes * 60_000 -
        (now.getTime() - new Date(session.lastActive).getTime())
      : undefined;
  const warning = remaining !== undefined && remaining <= 60_000;
  const expired = !!session && !!now && sessionExpired(session, now);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (warning && !expired && !element.open) element.showModal();
    if ((!warning || expired) && element.open) element.close();
  }, [warning, expired]);

  useEffect(() => {
    if (expired && session) signOutTo(router, session, "expired");
  }, [expired, session, router]);

  return (
    <dialog
      ref={dialog}
      className="search-dialog academic-dialog"
      aria-labelledby="timeout-title"
    >
      <h2 id="timeout-title">
        <Clock size={18} aria-hidden="true" /> Are you still there?
      </h2>
      <p>
        For your security you&apos;ll be signed out in{" "}
        <strong>{formatCountdown(remaining ?? 0)}</strong> because of
        inactivity.
      </p>
      <div className="academic-toolbar">
        <button
          type="button"
          className="button button-outline"
          onClick={() => session && signOutTo(router, session, "signedOut")}
        >
          Sign out now
        </button>
        <button
          type="button"
          className="button button-primary"
          onClick={() =>
            updateAuthState((state) => touchSession(state, new Date()))
          }
        >
          Stay signed in
        </button>
      </div>
    </dialog>
  );
}
