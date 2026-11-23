"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Search } from "lucide-react";
import { useDemo } from "../demo-context";
import { EmptyState, Meter, StatCards, TrendChart } from "../dashboard-widgets";
import { SectionCard } from "../page-header";

const number = (value: number) => new Intl.NumberFormat("en").format(value);

export function SchoolsDirectory() {
  const { schools, setSchool } = useDemo();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const term = query.trim().toLowerCase();
  const visible = schools.filter(
    (item) =>
      (!status || item.status === status) &&
      (item.name + " " + item.location + " " + item.plan)
        .toLowerCase()
        .includes(term),
  );
  return (
    <SectionCard
      title={schools.length + " institutions"}
      description="Open any school's workspace as its School Admin to help with setup."
      className="page-section"
      actions={
        <button
          type="button"
          className="button button-outline"
          disabled
          title="Planned: school onboarding and approval"
        >
          Add school · planned
        </button>
      }
    >
      <div className="filter-bar">
        <label className="inline-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search schools</span>
          <input
            type="search"
            placeholder="Search by name, city or plan"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            <option>Active</option>
            <option>Trial</option>
          </select>
        </label>
      </div>
      {visible.length ? (
        <div className="table-wrap">
          <table className="pro-table">
            <thead>
              <tr>
                <th scope="col">School</th>
                <th scope="col">Plan</th>
                <th scope="col">Status</th>
                <th scope="col">Students</th>
                <th scope="col">Teachers</th>
                <th scope="col">Attendance</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id}>
                  <th scope="row">
                    <span className="school-cell">
                      <span
                        className="school-badge small"
                        data-school={item.id}
                      >
                        {item.initials}
                      </span>
                      <span>
                        {item.name}
                        <small>{item.location}</small>
                      </span>
                    </span>
                  </th>
                  <td>{item.plan}</td>
                  <td>
                    <span
                      className={
                        "pill " +
                        (item.status === "Active"
                          ? "pill-success"
                          : "pill-warning")
                      }
                    >
                      {item.status}
                    </span>
                  </td>
                  <td>{number(item.students)}</td>
                  <td>{item.teachers}</td>
                  <td>{item.attendance}%</td>
                  <td>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setSchool(item.id);
                        router.push("/demo/school-admin");
                      }}
                    >
                      Open workspace
                      <ArrowUpRight size={13} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>No schools match these filters.</EmptyState>
      )}
    </SectionCard>
  );
}

export function PlatformAnalytics() {
  const { schools, data } = useDemo();
  const maxStudents = Math.max(...schools.map((item) => item.students));
  const students = schools.reduce((sum, item) => sum + item.students, 0);
  const plans = [...new Set(schools.map((item) => item.plan))];
  return (
    <>
      <StatCards
        stats={[
          {
            label: "Schools",
            value: String(schools.length),
            note:
              schools.filter((item) => item.status === "Trial").length +
              " on trial",
            icon: "schools",
          },
          {
            label: "Students",
            value: number(students),
            note: "Across all schools",
            icon: "students",
          },
          {
            label: "Teachers",
            value: number(
              schools.reduce((sum, item) => sum + item.teachers, 0),
            ),
            note: "Across all schools",
            icon: "teachers",
          },
          {
            label: "Average attendance",
            value:
              Math.round(
                (10 *
                  schools.reduce(
                    (sum, item) => sum + item.attendance * item.students,
                    0,
                  )) /
                  students,
              ) /
                10 +
              "%",
            note: "Weighted by students",
            icon: "attendance",
          },
        ]}
      />
      <div className="dashboard-grid feature-grid">
        <TrendChart chart={data.chart} sample />
        <SectionCard title="Plan mix" description="Schools on each plan.">
          <ul className="usage-list">
            {plans.map((plan) => {
              const count = schools.filter((item) => item.plan === plan).length;
              return (
                <li key={plan}>
                  <span>
                    {plan} <strong>{count}</strong>
                  </span>
                  <Meter
                    value={(100 * count) / schools.length}
                    label={count + " schools on " + plan}
                  />
                </li>
              );
            })}
          </ul>
        </SectionCard>
      </div>
      <SectionCard
        title="School comparison"
        description="Size and attendance for each institution."
        className="page-section"
      >
        <ul className="comparison-list">
          {schools.map((item) => (
            <li key={item.id}>
              <span className="school-cell">
                <span className="school-badge small" data-school={item.id}>
                  {item.initials}
                </span>
                <span>
                  {item.name}
                  <small>
                    {item.classes} classes · {item.teachers} teachers
                  </small>
                </span>
              </span>
              <span className="comparison-bars">
                <span>
                  Students <strong>{number(item.students)}</strong>
                  <Meter
                    value={(100 * item.students) / maxStudents}
                    label={item.students + " students"}
                  />
                </span>
                <span>
                  Attendance <strong>{item.attendance}%</strong>
                  <Meter
                    value={item.attendance}
                    label={item.attendance + "% attendance"}
                  />
                </span>
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </>
  );
}
