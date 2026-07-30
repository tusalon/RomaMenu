import type { Metadata } from "next";
import { AdminApp } from "@/app/components/AdminApp";

export const metadata: Metadata = { title: "Panel administrativo" };

export default function AdminPage() {
  return <AdminApp />;
}

