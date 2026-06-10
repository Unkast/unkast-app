import type { Metadata } from "next";
import DashboardClient from "./DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard — Unkast",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
