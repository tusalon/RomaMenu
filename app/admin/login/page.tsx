import type { Metadata } from "next";
import { AdminLogin } from "@/app/components/AdminLogin";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Acceso administrativo",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return <AdminLogin />;
}
