"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/common/brand";
import { findSchool, type SchoolBranding } from "@/services/branding-model";
import { useBrandingState } from "@/services/branding-store";
import type { SchoolId } from "@/types/demo";
import { SchoolLogo } from "../brand/school-brand";

export function SchoolFinder() {
  const branding = useBrandingState();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    const school = findSchool(branding, value);
    if (!school) {
      setError(
        "We couldn't find a school with that code. Check it with your school office.",
      );
      return;
    }
    router.push("/login/" + school);
  }
  return (
    <div className="auth-page">
      <header className="site-nav shell">
        <Brand />
        <Link className="button button-outline" href="/demo/select-profile">
          Explore the demo
        </Link>
      </header>
      <main className="shell auth-finder">
        <div className="auth-finder-copy">
          <span className="eyebrow">
            <span />
            Sign in
          </span>
          <h1>Find your school</h1>
          <p>
            Enter the school code from your welcome letter or school office.
          </p>
          <form className="auth-form" onSubmit={submit} noValidate>
            <label>
              School code
              <input
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setError("");
                }}
                placeholder="e.g. WFA26"
                autoComplete="organization"
                autoCapitalize="characters"
                aria-invalid={!!error}
                aria-describedby={error ? "finder-error" : undefined}
                required
              />
            </label>
            {error && (
              <p id="finder-error" role="alert" className="form-error">
                {error}
              </p>
            )}
            <button type="submit" className="button button-primary">
              Continue
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </form>
          <Link className="text-link" href="/login/platform">
            <ShieldCheck size={15} aria-hidden="true" />
            Platform owner sign-in
          </Link>
        </div>
        <section className="auth-school-list" aria-labelledby="demo-schools">
          <h2 id="demo-schools">
            <Building2 size={17} aria-hidden="true" />
            Demo schools
          </h2>
          <ul>
            {(
              Object.entries(branding.schools) as [SchoolId, SchoolBranding][]
            ).map(([id, item]) => (
              <li key={id}>
                <Link href={"/login/" + id} className="auth-school">
                  <SchoolLogo branding={item} size={42} />
                  <span>
                    <strong>{item.displayName}</strong>
                    <small>
                      Code {item.code} · {item.tagline}
                    </small>
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
