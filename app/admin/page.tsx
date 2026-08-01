import type { Metadata } from "next";
import { AdminApp } from "@/app/components/AdminApp";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Panel administrativo",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminApp />;
}
