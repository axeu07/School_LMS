import {
  Building2,
  ChevronDown,
  CircleUserRound,
  GraduationCap,
  HeartHandshake,
  Presentation,
  ShieldCheck,
} from "lucide-react";
import type { School, SchoolId } from "@/types/demo";

export const roleIcons = {
  "super-admin": ShieldCheck,
  "school-admin": Building2,
  teacher: Presentation,
  student: GraduationCap,
  parent: HeartHandshake,
};

export function DemoBanner() {
  return (
    <span className="demo-pill">
      <span aria-hidden="true" />
      Demo workspace
    </span>
  );
}

export function SchoolSelector({
  school,
  schools,
  onChange,
}: {
  school: School;
  schools: readonly School[];
  onChange: (id: SchoolId) => void;
}) {
  return (
    <label className="school-selector">
      <span className="school-avatar">{school.initials}</span>
      <span className="sr-only">Demo school</span>
      <select
        value={school.id}
        onChange={(event) => onChange(event.target.value as SchoolId)}
      >
        {schools.map(({ id, name }) => (
          <option value={id} key={id}>
            {name}
          </option>
        ))}
      </select>
      <ChevronDown size={15} aria-hidden="true" />
    </label>
  );
}

export function PersonIcon() {
  return <CircleUserRound size={17} aria-hidden="true" />;
}
