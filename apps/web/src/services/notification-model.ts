import type { DemoRole, SchoolId } from "@/types/demo";
import type { AssignmentActor } from "./assignment-model";

/**
 * In-app notifications for the calendar and messaging modules. They are
 * stored per school and addressed to one person in one role. Nothing here
 * sends email, SMS or WhatsApp.
 */
export type NotificationKind =
  "event" | "approval" | "ptm" | "message" | "reminder";

export type AppNotification = {
  id: string;
  schoolId: SchoolId;
  recipientId: string;
  recipientRole: DemoRole;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Route that opens the related record, e.g. a conversation. */
  href: string;
  /** The event, booking or conversation the notification is about. */
  contextId: string;
  /**
   * Identifies the transition that produced it ("event:x:cancelled"), so
   * the same transition never notifies the same person twice.
   */
  dedupeKey: string;
  createdAt: string;
  readAt: string | null;
  /** How many updates were merged into this unread notification. */
  count: number;
};

export type NotificationInput = Omit<
  AppNotification,
  "id" | "readAt" | "count" | "createdAt"
>;

/**
 * Adds a notification.
 * - "once": skipped when this recipient already has the same dedupe key.
 * - "merge": folded into an existing unread notification with the same key
 *   (used for messages, so a burst of replies shows as one entry).
 */
export function pushNotification(
  list: AppNotification[],
  input: NotificationInput,
  createdAt: string,
  mode: "once" | "merge" = "once",
): AppNotification[] {
  const same = (item: AppNotification) =>
    item.recipientId === input.recipientId &&
    item.recipientRole === input.recipientRole &&
    item.dedupeKey === input.dedupeKey;
  if (mode === "once") {
    if (list.some(same)) return list;
    return [
      ...list,
      {
        ...input,
        id: "ntf-" + input.recipientId + "-" + input.dedupeKey,
        createdAt,
        readAt: null,
        count: 1,
      },
    ];
  }
  const unread = list.find((item) => same(item) && !item.readAt);
  if (unread)
    return list.map((item) =>
      item === unread
        ? {
            ...item,
            title: input.title,
            body: input.body,
            href: input.href,
            createdAt,
            count: item.count + 1,
          }
        : item,
    );
  return [
    ...list,
    {
      ...input,
      id: "ntf-" + input.recipientId + "-" + input.dedupeKey + "-" + createdAt,
      createdAt,
      readAt: null,
      count: 1,
    },
  ];
}

export function isRecipient(item: AppNotification, actor: AssignmentActor) {
  return (
    item.schoolId === actor.school &&
    item.recipientId === actor.person &&
    item.recipientRole === actor.role
  );
}

/** The actor's own notifications, newest first. */
export function notificationsFor(
  list: AppNotification[],
  actor: AssignmentActor,
) {
  return list
    .filter((item) => isRecipient(item, actor))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function unreadNotificationCount(
  list: AppNotification[],
  actor: AssignmentActor,
) {
  return list.filter((item) => isRecipient(item, actor) && !item.readAt).length;
}

/**
 * Marks the actor's matching unread notifications read. Returns the same
 * array when nothing changed, so callers can skip a storage write.
 */
export function markRead(
  list: AppNotification[],
  actor: AssignmentActor,
  match: (item: AppNotification) => boolean,
  readAt: string,
) {
  let changed = false;
  const next = list.map((item) => {
    if (!isRecipient(item, actor) || item.readAt || !match(item)) return item;
    changed = true;
    return { ...item, readAt };
  });
  return changed ? next : list;
}
