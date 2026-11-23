"use client";

import Link from "next/link";

export default function ErrorScreen({ reset }: { reset: () => void }) {
  return (
    <main className="route-message">
      <h1>The demo couldn’t load.</h1>
      <button type="button" className="button button-primary" onClick={reset}>
        Try again
      </button>
      <Link href="/demo/select-profile">Choose another profile</Link>
    </main>
  );
}
