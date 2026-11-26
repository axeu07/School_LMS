"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenText } from "lucide-react";
import { Brand } from "@/components/common/brand";
import { roleProfiles } from "@/mocks/academics";
import { roleHidden } from "@/features/preschool/config";
import { demoRoles, type DemoRole } from "@/types/demo";
import { DemoBanner, roleIcons } from "./demo-ui";
import { setPreference, studentPreferenceKey } from "./preferences";

/** The student role is offered twice: a Class 8 and a Class 10 learner. */
const cards = demoRoles
  .filter((role) => !roleHidden(role))
  .flatMap<{ role: DemoRole; senior: boolean }>((role) =>
    role === "student"
      ? [
          { role, senior: false },
          { role, senior: true },
        ]
      : [{ role, senior: false }],
  );

export function ProfilePicker() {
  const router = useRouter();
  function enter(role: DemoRole, senior: boolean) {
    if (role === "student")
      setPreference(studentPreferenceKey, senior ? "senior" : "");
    router.push("/demo/" + role);
  }

  return (
    <div className="profile-page">
      <header className="site-nav shell">
        <Brand />
        <div className="card-actions">
          <Link className="button button-outline" href="/">
            Back to home
          </Link>
          <Link className="button button-primary" href="/login">
            Sign in
          </Link>
        </div>
      </header>
      <main className="shell profile-content">
        <DemoBanner />
        <h1>Choose your demo profile.</h1>
        <p>
          Step into a fictional workspace and see ACADMAXIS from a different
          perspective.
        </p>
        <div className="role-grid">
          {cards.map(({ role, senior }, index) => {
            const profile = roleProfiles[role];
            const Icon = senior ? BookOpenText : roleIcons[role];
            const student = role === "student";
            return (
              <button
                type="button"
                key={role + (senior ? "-senior" : "")}
                className="role-card"
                data-stage={senior ? "senior" : undefined}
                onClick={() => enter(role, senior)}
              >
                <span className={"role-icon tint-" + (index % 4)}>
                  <Icon size={23} aria-hidden="true" />
                </span>
                <span className="role-title">
                  {profile.label}
                  {student && (senior ? " · Class 10" : " · Class 8")}
                </span>
                <span className="role-description">
                  {senior
                    ? "A calm, book-like study space for board-exam years (Class 9 and above)."
                    : student
                      ? "A bright, playful space for younger learners (up to Class 8)."
                      : profile.description}
                </span>
                <span className="role-action">Enter Dashboard</span>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
