import type { Metadata, Viewport } from "next";
import { AdminPwaControls } from "@/app/components/AdminPwaControls";
import { appPath } from "@/app/lib/site-path";

export const metadata: Metadata = {
  applicationName: "Miguelón Admin",
  manifest: appPath("/admin.webmanifest"),
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Miguelón Admin",
  },
  icons: {
    icon: [
      { url: appPath("/icons/admin-192.png"), sizes: "192x192", type: "image/png" },
      { url: appPath("/icons/admin-512.png"), sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: appPath("/icons/admin-180.png"), sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#8f241f",
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <AdminPwaControls />
    </>
  );
}
