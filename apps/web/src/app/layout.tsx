import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import "@/styles/growth-and-assistant.css";

// Self-hosted variable font: crisp hinting at every weight (incl. 650/750)
// and identical rendering across Windows, macOS and mobile.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "School LMS | Teach and learn in one place",
  description:
    "Explore an interactive learning management system demo for schools and colleges.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
