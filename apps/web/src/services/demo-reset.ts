/**
 * The preschool build renamed classes and the school, so demo data saved by
 * the earlier K-12 build no longer matches. The first time this build runs in
 * a browser it clears the old demo records once, so every module starts from
 * the same fresh seed.
 */
const marker = "school-lms-preschool-build";
const build = "1";

function resetOldDemoData() {
  try {
    if (localStorage.getItem(marker) === build) return;
    const stale: string[] = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith("school-lms")) stale.push(key);
    }
    for (const key of stale) localStorage.removeItem(key);
    localStorage.setItem(marker, build);
  } catch {
    // Storage blocked: the demo runs in memory with fresh data anyway.
  }
}

if (typeof window !== "undefined") resetOldDemoData();
