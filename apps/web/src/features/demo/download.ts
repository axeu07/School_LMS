"use client";

import { updateCommunicationState } from "@/services/communication-store";
import {
  pushNotification,
  type NotificationInput,
} from "@/services/notification-model";
import type { SchoolId } from "@/types/demo";

/** Saves a file in the browser. */
export function downloadFile(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Adds in-app notifications for people in a school (shown in the bell). */
export function notify(
  school: SchoolId,
  inputs: Omit<NotificationInput, "schoolId">[],
) {
  if (!inputs.length) return;
  const createdAt = new Date().toISOString();
  updateCommunicationState((state) => {
    const current = state.schools[school];
    let notifications = current.notifications;
    for (const input of inputs)
      notifications = pushNotification(
        notifications,
        { ...input, schoolId: school },
        createdAt,
      );
    return notifications === current.notifications
      ? state
      : {
          ...state,
          schools: {
            ...state.schools,
            [school]: { ...current, notifications },
          },
        };
  });
}
