"use client";

import { useState } from "react";
import {
  CalendarCheck,
  Handshake,
  MapPin,
  Phone,
  UserCheck,
  UserX,
  Video,
} from "lucide-react";
import { useDemo } from "../demo-context";
import { EmptyState, Meter, StatCards } from "../dashboard-widgets";
import { PreviewNotice, SectionCard } from "../page-header";

const inr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

/* ---------- Leads ---------- */

const sources = [
  "Instagram",
  "Facebook",
  "Meta Ads",
  "Google",
  "Website",
  "Walk-in",
  "Referral",
] as const;
type Source = (typeof sources)[number];

const leadStages = [
  "New",
  "Contacted",
  "Campus visit",
  "Applied",
  "Admitted",
  "Lost",
] as const;
type LeadStage = (typeof leadStages)[number];

type Lead = {
  id: string;
  name: string;
  guardian: string;
  grade: string;
  source: Source;
  stage: LeadStage;
  received: string;
  followUp: string;
  campaign: string;
};

export const seedLeads: Lead[] = [
  { id: "l1", name: "Aarav Mehta", guardian: "Ritu Mehta", grade: "Grade 6", source: "Instagram", stage: "New", received: "22 Nov", followUp: "24 Nov", campaign: "Admissions open reel" },
  { id: "l2", name: "Sara Thomas", guardian: "Joseph Thomas", grade: "Grade 9", source: "Facebook", stage: "Contacted", received: "21 Nov", followUp: "25 Nov", campaign: "Science fair post" },
  { id: "l3", name: "Kabir Singh", guardian: "Harpreet Singh", grade: "Grade 1", source: "Meta Ads", stage: "Campus visit", received: "19 Nov", followUp: "26 Nov", campaign: "Early years lead form" },
  { id: "l4", name: "Ananya Iyer", guardian: "Lakshmi Iyer", grade: "Grade 11", source: "Google", stage: "Applied", received: "17 Nov", followUp: "27 Nov", campaign: "Search · best CBSE school" },
  { id: "l5", name: "Vihaan Rao", guardian: "Kiran Rao", grade: "Grade 4", source: "Website", stage: "Admitted", received: "12 Nov", followUp: "—", campaign: "Enquiry form" },
  { id: "l6", name: "Meera Kapoor", guardian: "Neha Kapoor", grade: "Grade 7", source: "Instagram", stage: "Contacted", received: "20 Nov", followUp: "24 Nov", campaign: "Sports day story" },
  { id: "l7", name: "Ishaan Das", guardian: "Arjun Das", grade: "Grade 2", source: "Walk-in", stage: "Campus visit", received: "18 Nov", followUp: "25 Nov", campaign: "Front office" },
  { id: "l8", name: "Zara Khan", guardian: "Farah Khan", grade: "Grade 8", source: "Referral", stage: "Applied", received: "15 Nov", followUp: "26 Nov", campaign: "Parent referral · Vihaan Rao" },
  { id: "l9", name: "Rohan Pillai", guardian: "Suresh Pillai", grade: "Grade 10", source: "Meta Ads", stage: "Lost", received: "10 Nov", followUp: "—", campaign: "Board results carousel" },
  { id: "l10", name: "Diya Sharma", guardian: "Pooja Sharma", grade: "Nursery", source: "Facebook", stage: "New", received: "23 Nov", followUp: "24 Nov", campaign: "Open house event" },
  { id: "l11", name: "Advik Nair", guardian: "Maya Nair", grade: "Grade 3", source: "Instagram", stage: "Admitted", received: "08 Nov", followUp: "—", campaign: "Admissions open reel" },
  { id: "l12", name: "Tara Bose", guardian: "Anil Bose", grade: "Grade 5", source: "Google", stage: "New", received: "23 Nov", followUp: "25 Nov", campaign: "Maps · school near me" },
];

const sourceTone: Record<Source, string> = {
  Instagram: "src-instagram",
  Facebook: "src-facebook",
  "Meta Ads": "src-meta",
  Google: "src-google",
  Website: "src-website",
  "Walk-in": "src-walkin",
  Referral: "src-referral",
};

const stagePill: Record<LeadStage, string> = {
  New: "pill-preview",
  Contacted: "pill-muted",
  "Campus visit": "pill-info",
  Applied: "pill-warning",
  Admitted: "pill-success",
  Lost: "pill-danger",
};

type Deal = {
  partner: string;
  kind: "Collaboration" | "Sponsorship" | "Vendor deal" | "Partnership";
  detail: string;
  value: number;
  stage: "Proposal" | "Negotiation" | "Agreement sent" | "Closing";
  close: string;
  probability: number;
};

export const deals: Deal[] = [
  { partner: "BrightMinds Robotics", kind: "Collaboration", detail: "After-school robotics lab for Grades 5–9", value: 450000, stage: "Negotiation", close: "05 Dec", probability: 60 },
  { partner: "City Sports Academy", kind: "Partnership", detail: "Weekend football & swimming coaching", value: 280000, stage: "Agreement sent", close: "29 Nov", probability: 80 },
  { partner: "Readwell Publishers", kind: "Vendor deal", detail: "Library refresh + 20% book discount", value: 175000, stage: "Closing", close: "26 Nov", probability: 90 },
  { partner: "GreenLeaf Foundation", kind: "Sponsorship", detail: "Eco-club & solar panel sponsorship", value: 600000, stage: "Proposal", close: "15 Dec", probability: 35 },
  { partner: "LinguaLeap", kind: "Collaboration", detail: "French & German language exchange", value: 120000, stage: "Negotiation", close: "10 Dec", probability: 55 },
];

const dealPill: Record<Deal["stage"], string> = {
  Proposal: "pill-muted",
  Negotiation: "pill-warning",
  "Agreement sent": "pill-info",
  Closing: "pill-success",
};

export function LeadsPreview() {
  const { school } = useDemo();
  const [leads, setLeads] = useState(seedLeads);
  const [source, setSource] = useState<"" | Source>("");
  const [stage, setStage] = useState<"" | LeadStage>("");
  const visible = leads.filter(
    (lead) => (!source || lead.source === source) && (!stage || lead.stage === stage),
  );
  const admitted = leads.filter((lead) => lead.stage === "Admitted").length;
  const open = leads.filter(
    (lead) => lead.stage !== "Admitted" && lead.stage !== "Lost",
  ).length;
  const bySource = sources
    .map((name) => ({
      name,
      count: leads.filter((lead) => lead.source === name).length,
    }))
    .sort((a, b) => b.count - a.count);
  const topCount = Math.max(1, ...bySource.map((item) => item.count));
  const pipelineValue = deals.reduce((sum, deal) => sum + deal.value, 0);
  const weighted = deals.reduce(
    (sum, deal) => sum + (deal.value * deal.probability) / 100,
    0,
  );

  return (
    <>
      <PreviewNotice
        summary={
          "Leads and deals for " +
          school.name +
          " are sample data. No Instagram, Facebook or Meta Ads account is connected."
        }
        planned={[
          "Capture leads automatically from Meta lead forms, Instagram DMs and the website",
          "Auto-assign follow-ups to the admissions desk with reminders",
          "Track collaborations and sponsorship deals through to signed agreement",
        ]}
      />
      <StatCards
        stats={[
          { label: "Total leads", value: String(leads.length), note: "Last 30 days · all sources", icon: "students" },
          { label: "Open leads", value: String(open), note: "Need a follow-up", icon: "tasks" },
          { label: "Admitted", value: String(admitted), note: Math.round((100 * admitted) / leads.length) + "% conversion", icon: "attendance" },
          { label: "Deals pipeline", value: inr(pipelineValue), note: inr(weighted) + " weighted", icon: "calendar" },
        ]}
      />
      <div className="dashboard-grid">
        <SectionCard
          title="Leads by source"
          description="Where enquiries came from this month."
        >
          <ul className="usage-list">
            {bySource.map((item) => (
              <li key={item.name}>
                <span>
                  <i className={"source-dot " + sourceTone[item.name]} />
                  {item.name} <strong>{item.count}</strong>
                </span>
                <Meter value={(100 * item.count) / topCount} label={item.name} />
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard
          title="Admissions funnel"
          description="Leads currently at or past each stage."
        >
          <ul className="usage-list">
            {leadStages
              .filter((name) => name !== "Lost")
              .map((name, index, list) => {
                const reached = leads.filter(
                  (lead) =>
                    lead.stage !== "Lost" &&
                    list.indexOf(lead.stage) >= index,
                ).length;
                return (
                  <li key={name}>
                    <span>
                      {name} <strong>{reached}</strong>
                    </span>
                    <Meter value={(100 * reached) / leads.length} label={name} />
                  </li>
                );
              })}
          </ul>
        </SectionCard>
      </div>
      <SectionCard
        title="Student leads"
        description="Update a lead's stage as the admissions desk follows up."
        className="page-section"
      >
        <div className="filter-bar">
          <label>
            Source
            <select value={source} onChange={(event) => setSource(event.target.value as Source)}>
              <option value="">All sources</option>
              {sources.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <label>
            Stage
            <select value={stage} onChange={(event) => setStage(event.target.value as LeadStage)}>
              <option value="">All stages</option>
              {leadStages.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
        </div>
        {visible.length ? (
          <div className="table-wrap">
            <table className="pro-table">
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col">Grade</th>
                  <th scope="col">Source</th>
                  <th scope="col">Received</th>
                  <th scope="col">Follow-up</th>
                  <th scope="col">Stage</th>
                  <th scope="col">Update</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((lead) => (
                  <tr key={lead.id}>
                    <th scope="row">
                      {lead.name}
                      <small>Guardian: {lead.guardian}</small>
                    </th>
                    <td>{lead.grade}</td>
                    <td>
                      <span className={"source-tag " + sourceTone[lead.source]}>
                        {lead.source}
                      </span>
                      <small className="cell-note">{lead.campaign}</small>
                    </td>
                    <td>{lead.received}</td>
                    <td>{lead.followUp}</td>
                    <td>
                      <span className={"pill " + stagePill[lead.stage]}>{lead.stage}</span>
                    </td>
                    <td>
                      <select
                        className="row-select"
                        aria-label={"Stage for " + lead.name}
                        value={lead.stage}
                        onChange={(event) =>
                          setLeads((current) =>
                            current.map((item) =>
                              item.id === lead.id
                                ? { ...item, stage: event.target.value as LeadStage }
                                : item,
                            ),
                          )
                        }
                      >
                        {leadStages.map((name) => (
                          <option key={name}>{name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>No leads match these filters.</EmptyState>
        )}
      </SectionCard>
      <SectionCard
        title="Upcoming deals & collaborations"
        description="Partnerships, sponsorships and vendor deals expected to close soon."
        className="page-section"
        actions={<Handshake size={20} className="muted-icon" aria-hidden="true" />}
      >
        <div className="deal-grid">
          {[...deals]
            .sort((a, b) => b.probability - a.probability)
            .map((deal) => (
              <article className="deal-card" key={deal.partner}>
                <header>
                  <span className="pill pill-muted">{deal.kind}</span>
                  <span className={"pill " + dealPill[deal.stage]}>{deal.stage}</span>
                </header>
                <h3>{deal.partner}</h3>
                <p>{deal.detail}</p>
                <div className="deal-meta">
                  <strong>{inr(deal.value)}</strong>
                  <span>Close by {deal.close}</span>
                </div>
                <div className="meter-cell">
                  <small>{deal.probability}% likely</small>
                  <Meter value={deal.probability} label={deal.probability + "% likely"} />
                </div>
              </article>
            ))}
        </div>
      </SectionCard>
    </>
  );
}

/* ---------- Recruitment ---------- */

const candidateStages = [
  "Applied",
  "Shortlisted",
  "Interview scheduled",
  "Offered",
  "Rejected",
] as const;
type CandidateStage = (typeof candidateStages)[number];

type Candidate = {
  id: string;
  name: string;
  role: string;
  experience: string;
  source: string;
  stage: CandidateStage;
  score?: number;
  interview?: { date: string; time: string; mode: "In person" | "Video"; panel: string };
  note?: string;
};

export const seedCandidates: Candidate[] = [
  { id: "c1", name: "Priya Menon", role: "Mathematics Teacher (PGT)", experience: "7 yrs", source: "Naukri", stage: "Interview scheduled", score: 86, interview: { date: "Tue 24 Nov", time: "10:30", mode: "In person", panel: "Principal · HOD Maths" } },
  { id: "c2", name: "Daniel Fernandes", role: "Physics Teacher (PGT)", experience: "5 yrs", source: "LinkedIn", stage: "Interview scheduled", score: 81, interview: { date: "Tue 24 Nov", time: "14:00", mode: "Video", panel: "HOD Science" } },
  { id: "c3", name: "Ayesha Siddiqui", role: "Primary Teacher (PRT)", experience: "3 yrs", source: "Referral", stage: "Interview scheduled", score: 78, interview: { date: "Wed 25 Nov", time: "11:00", mode: "In person", panel: "Primary coordinator" } },
  { id: "c4", name: "Rahul Verma", role: "Sports Coach", experience: "6 yrs", source: "Walk-in", stage: "Interview scheduled", score: 74, interview: { date: "Thu 26 Nov", time: "09:30", mode: "In person", panel: "Vice principal · PE head" } },
  { id: "c5", name: "Sneha Kulkarni", role: "School Counsellor", experience: "4 yrs", source: "Indeed", stage: "Interview scheduled", score: 83, interview: { date: "Fri 27 Nov", time: "15:00", mode: "Video", panel: "Principal" } },
  { id: "c6", name: "Vikram Joshi", role: "Computer Science Teacher", experience: "8 yrs", source: "LinkedIn", stage: "Shortlisted", score: 88 },
  { id: "c7", name: "Fatima Sheikh", role: "English Teacher (TGT)", experience: "4 yrs", source: "Naukri", stage: "Shortlisted", score: 79 },
  { id: "c8", name: "Arjun Reddy", role: "Mathematics Teacher (PGT)", experience: "2 yrs", source: "Indeed", stage: "Shortlisted", score: 72 },
  { id: "c9", name: "Neha Gupta", role: "Primary Teacher (PRT)", experience: "6 yrs", source: "Referral", stage: "Offered", score: 90, note: "Offer sent 20 Nov · awaiting acceptance" },
  { id: "c10", name: "Manoj Tiwari", role: "Accountant", experience: "10 yrs", source: "Naukri", stage: "Offered", score: 84, note: "Joining 1 Dec" },
  { id: "c11", name: "Kavya Hegde", role: "Art Teacher", experience: "1 yr", source: "Website", stage: "Applied" },
  { id: "c12", name: "Siddharth Rao", role: "Physics Teacher (PGT)", experience: "3 yrs", source: "LinkedIn", stage: "Applied" },
  { id: "c13", name: "Lina D'Souza", role: "Music Teacher", experience: "5 yrs", source: "Instagram", stage: "Applied" },
  { id: "c14", name: "Gaurav Malhotra", role: "Sports Coach", experience: "1 yr", source: "Walk-in", stage: "Rejected", score: 52, note: "Certification missing" },
  { id: "c15", name: "Pooja Bhatt", role: "English Teacher (TGT)", experience: "2 yrs", source: "Indeed", stage: "Rejected", score: 58, note: "Demo lesson below bar" },
  { id: "c16", name: "Imran Ali", role: "Computer Science Teacher", experience: "0 yrs", source: "Website", stage: "Rejected", score: 45, note: "Experience requirement not met" },
];

const candidatePill: Record<CandidateStage, string> = {
  Applied: "pill-muted",
  Shortlisted: "pill-info",
  "Interview scheduled": "pill-preview",
  Offered: "pill-success",
  Rejected: "pill-danger",
};

const openings = [
  { role: "Mathematics Teacher (PGT)", positions: 1, filled: 0 },
  { role: "Physics Teacher (PGT)", positions: 1, filled: 0 },
  { role: "Primary Teacher (PRT)", positions: 3, filled: 1 },
  { role: "Computer Science Teacher", positions: 1, filled: 0 },
  { role: "Sports Coach", positions: 1, filled: 0 },
  { role: "Accountant", positions: 1, filled: 1 },
];

const tabs = ["Upcoming interviews", "Shortlisted", "Offered", "Rejected", "All candidates"] as const;
type Tab = (typeof tabs)[number];

export function RecruitmentPreview() {
  const { school } = useDemo();
  const [candidates, setCandidates] = useState(seedCandidates);
  const [tab, setTab] = useState<Tab>("Upcoming interviews");
  const count = (stage: CandidateStage) =>
    candidates.filter((item) => item.stage === stage).length;
  const tabStage: Record<Tab, CandidateStage | undefined> = {
    "Upcoming interviews": "Interview scheduled",
    Shortlisted: "Shortlisted",
    Offered: "Offered",
    Rejected: "Rejected",
    "All candidates": undefined,
  };
  const visible = candidates.filter(
    (item) => !tabStage[tab] || item.stage === tabStage[tab],
  );
  const move = (id: string, stage: CandidateStage) =>
    setCandidates((current) =>
      current.map((item) => (item.id === id ? { ...item, stage } : item)),
    );
  const interviews = candidates.filter((item) => item.interview && item.stage === "Interview scheduled");

  return (
    <>
      <PreviewNotice
        summary={
          "Candidates and interviews for " +
          school.name +
          " are sample data. No job board is connected."
        }
        planned={[
          "Publish openings to job boards and the school careers page",
          "Interview scheduling with calendar invites for the panel",
          "Offer letters and onboarding into the teacher directory",
        ]}
      />
      <StatCards
        stats={[
          { label: "Open positions", value: String(openings.reduce((s, o) => s + o.positions - o.filled, 0)), note: openings.length + " roles hiring", icon: "teachers" },
          { label: "Upcoming interviews", value: String(interviews.length), note: "This week", icon: "calendar" },
          { label: "Shortlisted", value: String(count("Shortlisted")), note: "Awaiting interview slot", icon: "tasks" },
          { label: "Rejected", value: String(count("Rejected")), note: count("Offered") + " offers out", icon: "students" },
        ]}
      />
      <div className="dashboard-grid">
        <SectionCard title="Interviews this week" description="Panels and slots booked for shortlisted candidates.">
          {interviews.length ? (
            <ul className="interview-list">
              {interviews.map((item) => (
                <li key={item.id}>
                  <span className="interview-date">
                    <strong>{item.interview!.date.split(" ")[1]}</strong>
                    {item.interview!.date.split(" ")[0]}
                  </span>
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.role}</small>
                    <small className="interview-meta">
                      {item.interview!.mode === "Video" ? (
                        <Video size={13} aria-hidden="true" />
                      ) : (
                        <MapPin size={13} aria-hidden="true" />
                      )}
                      {item.interview!.time} · {item.interview!.mode} · {item.interview!.panel}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No interviews scheduled.</EmptyState>
          )}
        </SectionCard>
        <SectionCard title="Hiring pipeline" description="Candidates at each stage.">
          <ul className="usage-list">
            {candidateStages.map((stage) => (
              <li key={stage}>
                <span>
                  {stage} <strong>{count(stage)}</strong>
                </span>
                <Meter value={(100 * count(stage)) / candidates.length} label={stage} />
              </li>
            ))}
          </ul>
          <h3 className="subheading">Open roles</h3>
          <ul className="usage-list">
            {openings.map((opening) => (
              <li key={opening.role}>
                <span>
                  {opening.role}
                  <strong>
                    {opening.filled}/{opening.positions} filled
                  </strong>
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
      <SectionCard
        title="Candidates"
        description="Shortlist, schedule or reject candidates. Changes are kept for this visit only."
        className="page-section"
      >
        <div className="segmented-tabs" role="group" aria-label="Candidate view">
          {tabs.map((name) => (
            <button key={name} type="button" aria-pressed={tab === name} onClick={() => setTab(name)}>
              {name}
              <span className="tab-count">
                {tabStage[name] ? count(tabStage[name]!) : candidates.length}
              </span>
            </button>
          ))}
        </div>
        {visible.length ? (
          <div className="table-wrap">
            <table className="pro-table">
              <thead>
                <tr>
                  <th scope="col">Candidate</th>
                  <th scope="col">Experience</th>
                  <th scope="col">Source</th>
                  <th scope="col">Score</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id}>
                    <th scope="row">
                      {item.name}
                      <small>{item.role}</small>
                    </th>
                    <td>{item.experience}</td>
                    <td>{item.source}</td>
                    <td>{item.score ?? "—"}</td>
                    <td>
                      <span className={"pill " + candidatePill[item.stage]}>{item.stage}</span>
                      {item.interview && item.stage === "Interview scheduled" && (
                        <small className="cell-note">
                          {item.interview.date} · {item.interview.time}
                        </small>
                      )}
                      {item.note && <small className="cell-note">{item.note}</small>}
                    </td>
                    <td>
                      <div className="row-actions">
                        {(item.stage === "Applied" || item.stage === "Rejected") && (
                          <button type="button" className="button button-outline button-sm" onClick={() => move(item.id, "Shortlisted")}>
                            <UserCheck size={14} aria-hidden="true" /> Shortlist
                          </button>
                        )}
                        {item.stage === "Shortlisted" && (
                          <button
                            type="button"
                            className="button button-outline button-sm"
                            onClick={() =>
                              setCandidates((current) =>
                                current.map((entry) =>
                                  entry.id === item.id
                                    ? {
                                        ...entry,
                                        stage: "Interview scheduled",
                                        interview: entry.interview ?? {
                                          date: "Sat 28 Nov",
                                          time: "10:00",
                                          mode: "In person",
                                          panel: "Principal",
                                        },
                                      }
                                    : entry,
                                ),
                              )
                            }
                          >
                            <CalendarCheck size={14} aria-hidden="true" /> Schedule
                          </button>
                        )}
                        {item.stage === "Interview scheduled" && (
                          <button type="button" className="button button-outline button-sm" onClick={() => move(item.id, "Offered")}>
                            <Phone size={14} aria-hidden="true" /> Offer
                          </button>
                        )}
                        {item.stage !== "Rejected" && item.stage !== "Offered" && (
                          <button type="button" className="button button-outline button-sm button-danger" onClick={() => move(item.id, "Rejected")}>
                            <UserX size={14} aria-hidden="true" /> Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>No candidates in this view.</EmptyState>
        )}
      </SectionCard>
    </>
  );
}
