"use client";

import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";

type Toast = { id: number; text: string; tone: "success" | "error" };

/**
 * A small confirmation toast. `run` performs an action, shows `success` when
 * it works, and shows the thrown rule message when it doesn't.
 */
export function useToast() {
  const [toast, setToast] = useState<Toast>();
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(
      () => setToast(undefined),
      toast.tone === "error" ? 7000 : 4000,
    );
    return () => clearTimeout(timer);
  }, [toast]);
  const show = (text: string, tone: Toast["tone"] = "success") =>
    setToast({ id: Date.now(), text, tone });
  const run = (action: () => void, success: string) => {
    try {
      action();
      show(success);
      return true;
    } catch (failure) {
      show((failure as Error).message, "error");
      return false;
    }
  };
  const element = (
    <div className="toast-region" aria-live="polite" role="status">
      {toast && (
        <div className={"toast toast-" + toast.tone} key={toast.id}>
          {toast.tone === "success" ? (
            <CircleCheck size={18} aria-hidden="true" />
          ) : (
            <CircleAlert size={18} aria-hidden="true" />
          )}
          <span>{toast.text}</span>
          <button
            type="button"
            className="toast-close"
            aria-label="Dismiss"
            onClick={() => setToast(undefined)}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
  return { show, run, element };
}
