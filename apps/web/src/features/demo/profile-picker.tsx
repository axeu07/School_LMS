"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/common/brand";
import { roleProfiles } from "@/mocks/academics";
import { demoRoles, type DemoRole } from "@/types/demo";
import { DemoBanner, roleIcons } from "./demo-ui";

export function ProfilePicker() {
  const router = useRouter();
  function enter(role: DemoRole) {
    router.push("/demo/" + role);
  }

  return (
    <div className="profile-page">
      <header className="site-nav shell">
        <Brand />
        <Link className="button button-outline" href="/">
          Back to home
        </Link>
      </header>
      <main className="shell profile-content">
        <DemoBanner />
        <h1>Choose your demo profile.</h1>
        <p>
          Step into a fictional workspace and see the LMS from a different
          perspective.
        </p>
        <div className="role-grid">
          {demoRoles.map((role, index) => {
            const profile = roleProfiles[role];
            const Icon = roleIcons[role];
            return (
              <button
                type="button"
                key={role}
                className="role-card"
                onClick={() => enter(role)}
              >
                <span className={"role-icon tint-" + (index % 4)}>
                  <Icon size={23} aria-hidden="true" />
                </span>
                <span className="role-title">{profile.label}</span>
                <span className="role-description">{profile.description}</span>
                <span className="role-action">Enter Dashboard</span>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
