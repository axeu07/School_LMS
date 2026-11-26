"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Inbox,
  KeyRound,
  LogIn,
  Smartphone,
  UserRound,
} from "lucide-react";
import { Brand, productLogo } from "@/components/common/brand";
import { roleHidden } from "@/features/preschool/config";
import { roleProfiles } from "@/mocks/academics";
import { useAcademicState } from "@/services/academic-store";
import { logAudit } from "@/services/audit-store";
import {
  accountsFor,
  demoPassword,
  findAccount,
  newCode,
  passwordProblem,
  requestCode,
  resendSeconds,
  resetPassword,
  sessionTimeoutMinutes,
  signIn,
  signOut,
  verifyOtp,
  type AccountScope,
  type AuthResult,
} from "@/services/auth-model";
import {
  getAuthSnapshot,
  updateAuthState,
  useAuthState,
} from "@/services/auth-store";
import { useSchoolBranding } from "@/services/branding-store";
import { brandingSeed } from "@/services/branding-model";
import { brandStyle, SchoolLogo } from "../brand/school-brand";
import {
  childPreferenceKey,
  schoolPreferenceKey,
  setPreference,
} from "../demo/preferences";

type View = "password" | "otp" | "forgot";

const platformBranding = {
  ...brandingSeed.schools.westfield,
  displayName: "ACADMAXIS Platform",
  tagline: "Owner console",
  welcome: "Sign in to manage schools, plans and billing.",
  logo: productLogo,
};

const random = (size: number) => crypto.getRandomValues(new Uint32Array(size));

export function SignIn({ scope }: { scope: AccountScope }) {
  const platform = scope === "platform";
  const schoolBranding = useSchoolBranding(platform ? "westfield" : scope);
  const branding = platform ? platformBranding : schoolBranding;
  const academic = useAcademicState();
  const auth = useAuthState();
  const router = useRouter();
  const params = useSearchParams();
  // Hidden roles (children, in the preschool) have no sign-in.
  const accounts = accountsFor(academic, scope).filter(
    (account) => !roleHidden(account.role),
  );
  const [view, setView] = useState<View>("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sentAt, setSentAt] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(
    params.get("expired")
      ? "You were signed out after " +
          sessionTimeoutMinutes +
          " minutes of inactivity."
      : params.get("signedOut")
        ? "You have signed out."
        : "",
  );
  const session =
    auth.session && auth.session.school === scope ? auth.session : null;
  const outbox = auth.outbox
    .filter((item) => item.school === scope)
    .slice(0, 4);

  const switchView = (next: View) => {
    setView(next);
    setError("");
    setNotice("");
    setCode("");
    setCodeSent(false);
  };

  function enter(result: AuthResult, method: string) {
    updateAuthState(() => result.auth);
    const started = result.auth.session;
    if (result.error || !started) {
      setError(result.error ?? "Sign-in failed.");
      return;
    }
    if (!platform) {
      setPreference(schoolPreferenceKey, scope);
      if (started.role === "parent")
        setPreference(childPreferenceKey(scope), "");
    }
    logAudit(
      scope,
      "Access",
      "Signed in",
      method + " · " + roleProfiles[started.role].label,
      {
        role: started.role,
        name: started.name,
      },
    );
    router.push("/demo/" + started.role);
  }

  function submitPassword(event: FormEvent) {
    event.preventDefault();
    setError("");
    const now = new Date();
    const result = signIn(
      getAuthSnapshot(),
      accounts,
      identifier,
      password,
      now,
    );
    const account = findAccount(accounts, identifier);
    if (result.error && account) {
      const locked = result.auth.attempts[account.key]?.lockedUntil;
      if (locked && !getAuthSnapshot().attempts[account.key]?.lockedUntil)
        logAudit(
          scope,
          "Access",
          "Account locked",
          account.name + " · too many failed attempts",
          {
            role: "system",
            name: "System",
          },
        );
    }
    enter(result, "Password");
    setPassword("");
  }

  function sendCode(purpose: "otp" | "reset") {
    setError("");
    const target = purpose === "otp" ? phone : identifier;
    if (!target.trim()) {
      setError(
        purpose === "otp" ? "Enter your mobile number." : "Enter your email.",
      );
      return;
    }
    if (Date.now() - sentAt < resendSeconds * 1000) {
      setError(
        "Please wait " +
          resendSeconds +
          " seconds before requesting another code.",
      );
      return;
    }
    updateAuthState((state) =>
      requestCode(
        state,
        accounts,
        purpose,
        target,
        new Date(),
        newCode(random),
      ),
    );
    setSentAt(Date.now());
    setCodeSent(true);
    setNotice(
      purpose === "otp"
        ? "If this number is registered, we've sent a 6-digit code. It expires in 10 minutes."
        : "If this email has an account, we've sent a reset code. It expires in 10 minutes.",
    );
  }

  function submitOtp(event: FormEvent) {
    event.preventDefault();
    if (!codeSent) {
      sendCode("otp");
      return;
    }
    enter(
      verifyOtp(getAuthSnapshot(), accounts, phone, code, new Date()),
      "Phone OTP",
    );
  }

  function submitReset(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!codeSent) {
      sendCode("reset");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The passwords don't match.");
      return;
    }
    const problem = passwordProblem(newPassword, identifier);
    if (problem) {
      setError(problem);
      return;
    }
    const result = resetPassword(
      getAuthSnapshot(),
      accounts,
      identifier,
      code,
      newPassword,
      new Date(),
    );
    updateAuthState(() => result.auth);
    if (result.error) {
      setError(result.error);
      return;
    }
    const account = findAccount(accounts, identifier);
    logAudit(scope, "Access", "Password reset", account?.name ?? identifier, {
      role: account?.role ?? "system",
      name: account?.name ?? "Unknown",
    });
    switchView("password");
    setPassword("");
    setNotice("Your password was changed. Sign in with your new password.");
  }

  return (
    <div className="auth-page auth-branded" style={brandStyle(branding)}>
      <header className="site-nav shell">
        <Link href="/login" className="text-link">
          <ArrowLeft size={15} aria-hidden="true" />
          Change school
        </Link>
        <Brand />
      </header>
      <main className="shell auth-layout">
        <section className="auth-card dash-card" aria-labelledby="signin-title">
          <div className="auth-school-head">
            <SchoolLogo branding={branding} size={52} />
            <div>
              <h1 id="signin-title">{branding.displayName}</h1>
              <p>{branding.tagline}</p>
            </div>
          </div>
          <p className="auth-welcome">{branding.welcome}</p>

          {session ? (
            <div className="auth-signed-in">
              <p>
                You&apos;re signed in as <strong>{session.name}</strong> (
                {roleProfiles[session.role].label}).
              </p>
              <div className="card-actions">
                <Link
                  className="button button-primary"
                  href={"/demo/" + session.role}
                >
                  Continue
                </Link>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => {
                    logAudit(scope, "Access", "Signed out", session.name, {
                      role: session.role,
                      name: session.name,
                    });
                    updateAuthState(signOut);
                    setNotice("You have signed out.");
                  }}
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <>
              {view !== "forgot" && !platform && (
                <div
                  className="segmented-tabs auth-tabs"
                  role="tablist"
                  aria-label="Sign-in method"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={view === "password"}
                    onClick={() => switchView("password")}
                  >
                    <KeyRound size={15} aria-hidden="true" />
                    Password
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={view === "otp"}
                    onClick={() => switchView("otp")}
                  >
                    <Smartphone size={15} aria-hidden="true" />
                    Parent OTP
                  </button>
                </div>
              )}
              {notice && (
                <p role="status" className="auth-notice">
                  {notice}
                </p>
              )}
              {error && (
                <p role="alert" className="form-error auth-error">
                  {error}
                </p>
              )}

              {view === "password" && (
                <form className="auth-form" onSubmit={submitPassword}>
                  <label>
                    {platform || roleHidden("student")
                      ? "Email"
                      : "Email or student number"}
                    <input
                      value={identifier}
                      onChange={(event) => setIdentifier(event.target.value)}
                      autoComplete="username"
                      required
                    />
                  </label>
                  <label>
                    <span className="label-row">
                      Password
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => switchView("forgot")}
                      >
                        Forgot password?
                      </button>
                    </span>
                    <span className="password-field">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        className="icon-button small"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff size={16} aria-hidden="true" />
                        ) : (
                          <Eye size={16} aria-hidden="true" />
                        )}
                      </button>
                    </span>
                  </label>
                  <button type="submit" className="button button-primary">
                    <LogIn size={16} aria-hidden="true" />
                    Sign in
                  </button>
                </form>
              )}

              {view === "otp" && (
                <form className="auth-form" onSubmit={submitOtp}>
                  <label>
                    Parent mobile number
                    <input
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      autoComplete="tel"
                      placeholder="+91 98xxx xxxxx"
                      disabled={codeSent}
                      required
                    />
                  </label>
                  {codeSent && (
                    <label>
                      6-digit code
                      <input
                        value={code}
                        onChange={(event) =>
                          setCode(event.target.value.replace(/\D/g, ""))
                        }
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        required
                      />
                    </label>
                  )}
                  <button type="submit" className="button button-primary">
                    {codeSent ? "Verify and sign in" : "Send code"}
                  </button>
                  {codeSent && (
                    <div className="card-actions">
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => sendCode("otp")}
                      >
                        Resend code
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          setCodeSent(false);
                          setCode("");
                        }}
                      >
                        Use a different number
                      </button>
                    </div>
                  )}
                </form>
              )}

              {view === "forgot" && (
                <form className="auth-form" onSubmit={submitReset}>
                  <h2 className="auth-subtitle">Reset your password</h2>
                  <label>
                    Email
                    <input
                      type="email"
                      value={identifier}
                      onChange={(event) => setIdentifier(event.target.value)}
                      autoComplete="username"
                      disabled={codeSent}
                      required
                    />
                    <span className="field-hint">
                      Students: ask your school office to reset your password.
                    </span>
                  </label>
                  {codeSent && (
                    <>
                      <label>
                        Reset code
                        <input
                          value={code}
                          onChange={(event) =>
                            setCode(event.target.value.replace(/\D/g, ""))
                          }
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          required
                        />
                      </label>
                      <label>
                        New password
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(event) =>
                            setNewPassword(event.target.value)
                          }
                          autoComplete="new-password"
                          required
                        />
                        <span className="field-hint">
                          At least 8 characters, with letters and numbers.
                        </span>
                      </label>
                      <label>
                        Confirm new password
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(event) =>
                            setConfirmPassword(event.target.value)
                          }
                          autoComplete="new-password"
                          required
                        />
                      </label>
                    </>
                  )}
                  <button type="submit" className="button button-primary">
                    {codeSent ? "Change password" : "Send reset code"}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => switchView("password")}
                  >
                    Back to sign in
                  </button>
                </form>
              )}
            </>
          )}
          <p className="field-hint auth-footnote">
            You&apos;ll be signed out after {sessionTimeoutMinutes} minutes of
            inactivity.
          </p>
        </section>

        <aside className="auth-demo" aria-label="Demo help">
          <section className="dash-card">
            <h2>
              <UserRound size={17} aria-hidden="true" />
              Demo accounts
            </h2>
            <p className="field-hint">
              Password for every account: <code>{demoPassword}</code>
            </p>
            <ul className="demo-accounts">
              {accounts.map((account) => (
                <li key={account.key}>
                  <span>
                    <strong>
                      {roleProfiles[account.role].label}
                      {account.role === "student" && " · " + account.name}
                    </strong>
                    <small>
                      {account.email || account.studentNumber}
                      {account.phone && " · " + account.phone}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      switchView("password");
                      setIdentifier(account.email || account.studentNumber);
                      setPassword(demoPassword);
                    }}
                  >
                    Use
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="dash-card">
            <h2>
              <Inbox size={17} aria-hidden="true" />
              Demo inbox
            </h2>
            <p className="field-hint">
              Codes that would be sent by SMS or email appear here. Nothing is
              actually sent.
            </p>
            {outbox.length ? (
              <ul className="stack-list">
                {outbox.map((item) => (
                  <li key={item.id}>
                    <strong>
                      {item.channel} to {item.to}
                    </strong>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted-copy">No messages yet.</p>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}
