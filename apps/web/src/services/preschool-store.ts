"use client";

import type { SchoolId } from "@/types/demo";
import { localCalendarDate } from "./assignment-model";
import { createLocalStore, useLocalStore } from "./local-store";
import {
  decodePreschoolState,
  schoolOf,
  type PreschoolState,
} from "./preschool-model";
import { buildPreschoolSeed } from "./preschool-seed";

const today = () => localCalendarDate(new Date());

const store = createLocalStore<PreschoolState>(
  "school-lms-preschool",
  buildPreschoolSeed(today()),
  (raw) => decodePreschoolState(raw, today(), buildPreschoolSeed),
);

export function usePreschoolState() {
  return useLocalStore(store);
}

export function usePreschoolSchool(school: SchoolId) {
  return schoolOf(usePreschoolState(), school);
}

export function updatePreschoolState(
  update: (state: PreschoolState) => PreschoolState,
) {
  store.update(update);
}

export function resetPreschoolState() {
  store.reset();
}
