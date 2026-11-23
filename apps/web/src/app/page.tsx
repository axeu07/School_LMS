import {
  Activity,
  BookOpen,
  Check,
  GraduationCap,
  LayoutDashboard,
  Palette,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/common/brand";
import { StatCards, TrendChart } from "@/features/demo/dashboard-widgets";
import { roleIcons } from "@/features/demo/demo-ui";
import { roleProfiles } from "@/mocks/academics";
import { getDemoDashboard } from "@/services/demo-service";
import { demoRoles } from "@/types/demo";

const demo = "/demo/select-profile";
const overview = getDemoDashboard("school-admin", "westfield")!;
const features = [
  {
    icon: BookOpen,
    title: "Learning in one place",
    text: "Connect courses, homework and assessments so students can see what to do next.",
  },
  {
    icon: Activity,
    title: "Progress you can act on",
    text: "Bring attendance and academic performance into a shared view for teachers and school leaders.",
  },
  {
    icon: GraduationCap,
    title: "A workspace for every role",
    text: "Give administrators, teachers, students and families tools for their day-to-day work.",
  },
];

export default function Home() {
  return (
    <div className="marketing-page">
      <header className="site-nav shell">
        <Brand />
        <nav aria-label="Main navigation" className="marketing-nav">
          <a href="#features">Features</a>
          <a href="#roles">Roles</a>
          <a href="#analytics">Analytics</a>
        </nav>
        <Link href={demo} className="button button-outline">
          Login
        </Link>
      </header>
      <main>
        <section className="hero shell">
          <div className="hero-copy">
            <span className="eyebrow">
              <span aria-hidden="true" /> The LMS for schools &amp; colleges
            </span>
            <h1>
              One place to <em>teach and learn.</em>
            </h1>
            <p>
              Bring classes, coursework and progress together in an LMS built
              for the whole school community.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href={demo}>
                Explore Demo
              </Link>
              <a className="button button-outline" href="#features">
                See features
              </a>
            </div>
            <p className="hero-note">
              <Check size={16} aria-hidden="true" /> Five demo profiles. No
              account needed.
            </p>
          </div>
          <div
            className="preview-frame"
            aria-label="School administrator dashboard preview"
          >
            <div className="preview-browser">
              <span className="window-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span>School LMS / Overview</span>
              <span className="preview-live">Demo preview</span>
            </div>
            <div className="preview-app">
              <div className="preview-rail" aria-hidden="true">
                <span>
                  <LayoutDashboard size={16} />
                </span>
                <BookOpen size={16} />
                <Activity size={16} />
              </div>
              <div className="preview-main">
                <p>Westfield Academy</p>
                <h2>School overview</h2>
                <StatCards stats={overview.stats} />
                <TrendChart chart={overview.chart} />
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="marketing-section shell">
          <div className="section-heading">
            <span>Learning operations</span>
            <h2>Run the school day from one workspace.</h2>
          </div>
          <div className="feature-cards">
            {features.map(({ icon: Icon, title, text }, index) => (
              <article key={title} className="marketing-card">
                <span className={"role-icon tint-" + index}>
                  <Icon size={22} aria-hidden="true" />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="roles" className="role-band">
          <div className="shell marketing-section">
            <div className="section-heading">
              <span>Role-based workspaces</span>
              <h2>The right view for each person.</h2>
            </div>
            <div className="marketing-roles">
              {demoRoles.map((role, index) => {
                const Icon = roleIcons[role];
                return (
                  <Link
                    key={role}
                    href={"/demo/" + role}
                    className="marketing-role"
                  >
                    <span className={"role-icon tint-" + (index % 4)}>
                      <Icon size={21} aria-hidden="true" />
                    </span>
                    <h3>{roleProfiles[role].label}</h3>
                    <p>{roleProfiles[role].description}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
        <section
          id="analytics"
          className="shell marketing-section spotlight-grid"
        >
          <article className="spotlight spotlight-ai">
            <Sparkles size={26} aria-hidden="true" />
            <span>Simulated AI</span>
            <h2>Help students take the next step.</h2>
            <p>
              Students can try a sample homework hint, and teachers can preview
              lesson outlines and practice prompts.
            </p>
            <Link
              className="button button-outline"
              href="/demo/student/ai-homework-helper"
            >
              Try the learning tools
            </Link>
          </article>
          <article className="spotlight">
            <Activity size={26} aria-hidden="true" />
            <span>Academic analytics</span>
            <h2>See how learning is progressing.</h2>
            <p>
              Explore assessment trends, attendance, and course completion with
              fictional school records.
            </p>
            <Link className="button button-outline" href="/demo/school-admin">
              View the school dashboard
            </Link>
          </article>
          <article className="spotlight white-label">
            <Palette size={26} aria-hidden="true" />
            <div>
              <span>White-label workspaces</span>
              <h2>Give each institution its own identity.</h2>
              <p>
                Switch between three fictional schools to preview separate
                workspaces with their own names and records.
              </p>
            </div>
            <Link
              className="button button-outline"
              href="/demo/super-admin/schools"
            >
              Explore school workspaces
            </Link>
          </article>
        </section>
        <section className="shell">
          <div className="closing-cta">
            <div>
              <h2>See it from your side of the classroom.</h2>
              <p>Choose a role and explore the LMS with sample data.</p>
            </div>
            <Link className="button button-white" href={demo}>
              Explore Demo
            </Link>
          </div>
        </section>
      </main>
      <footer className="shell site-footer">
        <Brand />
        <p>School and college learning management.</p>
        <nav aria-label="Footer navigation">
          <a href="#features">Features</a>
          <Link href={demo}>Demo</Link>
        </nav>
      </footer>
    </div>
  );
}
