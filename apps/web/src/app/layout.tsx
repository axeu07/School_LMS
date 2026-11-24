import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Inter, Nunito } from "next/font/google";
import "@/styles/globals.css";
import "@/styles/growth-and-assistant.css";
import "@/styles/leave.css";
import "@/styles/attendance-heatmap.css";
import "@/styles/calendar-and-messages.css";
import "@/styles/motion.css";
import "@/styles/role-themes.css";
import "@/styles/senior-student.css";
import { MotionLayer } from "@/components/common/motion-layer";

// Self-hosted variable font: crisp hinting at every weight (incl. 650/750)
// and identical rendering across Windows, macOS and mobile.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});
// Rounded, friendly face for the student workspace.
const nunito = Nunito({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-nunito",
});
// Calm editorial serif for parent headings.
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "ACADMAXIS | Teach and learn in one place",
  description:
    "Explore an interactive learning management system demo for schools and colleges.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={[inter.variable, nunito.variable, fraunces.variable].join(" ")}
    >
      <body suppressHydrationWarning>
        {children}
        <MotionLayer />
      </body>
    </html>
  );
}
