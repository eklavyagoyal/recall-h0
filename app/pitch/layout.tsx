import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./pitch.css";

export const metadata: Metadata = {
  title: "Recall — A product recall, in one query",
  description:
    "A product recall solved as a single Aurora PostgreSQL query — graph recursion, PostGIS, and pgvector in one statement. Watched live.",
};

export default function PitchLayout({ children }: { children: ReactNode }) {
  return <main className="pitch pitch-noise">{children}</main>;
}
