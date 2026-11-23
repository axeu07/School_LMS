"use client";

import type { SchoolId } from "@/types/demo";
import {
  brandingSeed,
  decodeBrandingState,
  type BrandingState,
} from "./branding-model";
import { createLocalStore, useLocalStore } from "./local-store";

const store = createLocalStore(
  "school-lms-branding",
  brandingSeed,
  decodeBrandingState,
);

export function useBrandingState() {
  return useLocalStore(store);
}

export function useSchoolBranding(school: SchoolId) {
  return useBrandingState().schools[school];
}

export function updateBrandingState(
  update: (state: BrandingState) => BrandingState,
) {
  store.update(update);
}

export function resetBrandingState() {
  store.reset();
}
