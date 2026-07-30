import type { Metadata } from "next";
import { AdminLogin } from "@/app/components/AdminLogin";

export const metadata: Metadata = { title: "Acceso administrativo" };

export default function AdminLoginPage() {
  return <AdminLogin />;
}

