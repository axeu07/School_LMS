"use client";

import { decodeFeeState, feeSeed, type FeeState } from "./fee-model";
import { createLocalStore, useLocalStore } from "./local-store";
import { getAcademicSnapshot } from "./academic-store";
import { diffFees } from "./audit-model";
import { recordAudit } from "./audit-store";

const store = createLocalStore(
  "school-lms-fees",
  feeSeed,
  decodeFeeState,
  (before, after) =>
    recordAudit(
      diffFees(before, after, (id) => getAcademicSnapshot().schools[id]),
    ),
);

export function useFeeState() {
  return useLocalStore(store);
}

export function updateFeeState(update: (state: FeeState) => FeeState) {
  store.update(update);
}

export function resetFeeState() {
  store.reset();
}

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatRupees(value: number) {
  return rupees.format(value);
}
