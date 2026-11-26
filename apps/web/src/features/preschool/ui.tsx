"use client";

import { useEffect, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { CircleCheck, ImageUp, Info, X, type LucideIcon } from "lucide-react";
import { useDemo } from "@/features/demo/demo-context";
import { useToast } from "@/features/demo/toast";
import { localCalendarDate } from "@/services/assignment-model";
import { useNow } from "@/services/learning-store";
import {
  childrenFor,
  clock,
  maxPhotoLength,
  teacherSections,
  type PreschoolState,
} from "@/services/preschool-model";
import {
  updatePreschoolState,
  usePreschoolSchool,
} from "@/services/preschool-store";
import { formatDate } from "@/features/demo/format";

/** Everything a preschool page needs, from the shared demo context. */
export function usePreschool(tick = 30_000) {
  const demo = useDemo();
  const school = usePreschoolSchool(demo.schoolId);
  const now = useNow(tick);
  const toast = useToast();
  const { records, actor } = demo;
  const today = now ? localCalendarDate(now) : "";
  const children = childrenFor(records, actor);
  const sections =
    actor.role === "teacher"
      ? teacherSections(records, actor.person)
      : records.sections.filter((item) =>
          children.some((child) => child.section === item.id),
        );
  /** Runs a model command and shows its outcome as a toast. */
  const act = (
    change: (state: PreschoolState) => PreschoolState,
    success: string,
  ) => toast.run(() => updatePreschoolState(change), success);
  return {
    ...demo,
    school,
    now,
    today,
    time: now ? clock(now) : "",
    iso: now ? now.toISOString() : "",
    children,
    sections,
    act,
    toast,
  };
}
export type Preschool = ReturnType<typeof usePreschool>;

/** Waits for the client clock so day-based data never mismatches on load. */
export function Ready({
  now,
  children,
}: {
  now: Date | undefined;
  children: ReactNode;
}) {
  if (!now)
    return (
      <div className="pk-loading" aria-busy="true">
        <span />
        <span />
        <span />
      </div>
    );
  return <>{children}</>;
}

const avatarTones = ["#dfe7d6", "#f1e3cf", "#dde6ec", "#efdfe3", "#e6e2f0"];
const avatarInk = ["#2f4b33", "#7a5427", "#2f4d63", "#7b3a4a", "#4b3f72"];

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export function Avatar({
  name,
  photo,
  size = 40,
}: {
  name: string;
  photo?: string;
  size?: number;
}) {
  if (photo)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- data URL photo
      <img
        className="pk-avatar"
        src={photo}
        alt=""
        width={size}
        height={size}
      />
    );
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const tone = hash % avatarTones.length;
  return (
    <span
      className="pk-avatar"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        background: avatarTones[tone],
        color: avatarInk[tone],
        fontSize: size * 0.36,
      }}
    >
      {initialsOf(name)}
    </span>
  );
}

export type Tone = "good" | "warn" | "danger" | "info" | "muted" | "accent";

export function Pill({
  tone = "muted",
  children,
  icon: Icon,
}: {
  tone?: Tone;
  children: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <span className="pk-pill" data-tone={tone}>
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function Card({
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
  className = "",
  tone,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: "alert";
}) {
  return (
    <section className={"pk-card " + className} data-tone={tone}>
      {(title || actions) && (
        <header className="pk-card-head">
          {Icon && (
            <span className="pk-card-icon">
              <Icon size={17} aria-hidden="true" />
            </span>
          )}
          <div className="pk-card-titles">
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="pk-card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: "warn" | "good";
}) {
  return (
    <div className="pk-stat" data-tone={tone}>
      <span className="pk-stat-icon">
        <Icon size={22} aria-hidden="true" />
      </span>
      <span className="pk-stat-copy">
        <strong>{value}</strong>
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="pk-empty">
      <CircleCheck size={16} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="pk-note">
      <Info size={15} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** A select for staff pages: one class, or every class the actor can see. */
export function ClassFilter({
  value,
  onChange,
  sections,
  all = true,
}: {
  value: string;
  onChange: (value: string) => void;
  sections: { id: string; grade: string; name: string }[];
  all?: boolean;
}) {
  return (
    <label className="pk-select">
      <span className="sr-only">Class</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {all && <option value="all">All classes</option>}
        {sections.map((item) => (
          <option key={item.id} value={item.id}>
            {item.grade} · {item.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** "Today", "Yesterday" or a date. */
export function dayLabel(date: string, today: string) {
  if (date === today) return "Today";
  const yesterday = new Date(today + "T00:00:00");
  yesterday.setDate(yesterday.getDate() - 1);
  if (date === localCalendarDate(yesterday)) return "Yesterday";
  return formatDate(date);
}

export function weekday(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
  });
}

/** 12-hour clock for parents: "1:30 pm". */
export function friendlyTime(time: string) {
  if (!/^\d{2}:\d{2}$/.test(time)) return time;
  const [h, m] = time.split(":").map(Number);
  return (
    ((h + 11) % 12) +
    1 +
    ":" +
    String(m).padStart(2, "0") +
    (h < 12 ? " am" : " pm")
  );
}

/** A real, scannable QR code for a pickup pass. */
export function QrCode({ text, size = 168 }: { text: string; size?: number }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let live = true;
    QRCode.toString(text, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#1f3d2e", light: "#ffffff" },
    })
      .then((value) => live && setSvg(value))
      .catch(() => live && setSvg(""));
    return () => {
      live = false;
    };
  }, [text]);
  return (
    <span
      className="pk-qr"
      role="img"
      aria-label={"QR pass " + text}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}

/** Picks a small photo and returns it as a data URL. */
export function PhotoField({
  value,
  name,
  onChange,
  onError,
}: {
  value: string;
  name: string;
  onChange: (value: string) => void;
  onError: (message: string) => void;
}) {
  return (
    <div className="pk-photo-field">
      <Avatar name={name || "?"} photo={value} size={56} />
      <label className="button button-outline file-button">
        <ImageUp size={15} aria-hidden="true" />
        {value ? "Change photo" : "Add photo"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
              return onError("Choose a PNG, JPG or WebP photo.");
            const reader = new FileReader();
            reader.onload = () => {
              const data = String(reader.result);
              if (data.length > maxPhotoLength)
                onError("The photo must be under 200 KB.");
              else onChange(data);
            };
            reader.readAsDataURL(file);
          }}
        />
      </label>
      {value && (
        <button
          type="button"
          className="text-button"
          onClick={() => onChange("")}
        >
          Remove
        </button>
      )}
    </div>
  );
}

/** A modal shell built on <dialog>, opened while `open` is true. */
export function Modal({
  open,
  title,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const [element, setElement] = useState<HTMLDialogElement | null>(null);
  useEffect(() => {
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open, element]);
  return (
    <dialog
      ref={setElement}
      className={"search-dialog pk-modal" + (wide ? " pk-modal-wide" : "")}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open && (
        <div className="pk-modal-body">
          <div className="dialog-heading">
            <h2>{title}</h2>
            <button
              type="button"
              className="icon-button"
              aria-label="Close"
              onClick={onClose}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
