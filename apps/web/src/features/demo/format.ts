const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

/** "2026-11-23" → "23 Nov 2026" */
export function formatDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  return (
    Number(value.slice(8, 10)) +
    " " +
    months[Number(value.slice(5, 7)) - 1] +
    " " +
    value.slice(0, 4)
  );
}

/** "2026-11-23T09:30" → "23 Nov 2026, 09:30" */
export function formatDateTime(value: string) {
  return formatDate(value) + ", " + value.slice(11, 16);
}

/** Milliseconds → "mm:ss" (or "h:mm:ss"). */
export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    (hours ? hours + ":" + pad(minutes) : pad(minutes)) + ":" + pad(seconds)
  );
}

/** A unique id for a new demo record, e.g. "westfield-event-lx2k-1a2b3c4d". */
export function newId(prefix: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return prefix + "-" + Date.now().toString(36) + "-" + random;
}
