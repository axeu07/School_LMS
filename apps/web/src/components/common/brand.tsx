import { Layers3 } from "lucide-react";
import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brand-mark">
        <Layers3 size={20} aria-hidden="true" />
      </span>
      <span>
        School<span className="brand-accent"> LMS</span>
      </span>
    </Link>
  );
}
