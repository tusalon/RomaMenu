import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);

  return {
    metadataBase,
    title: {
      default: "La Cocina de Miguelón | Comida casera a domicilio",
      template: "%s | La Cocina de Miguelón",
    },
    description: "Pide comida casera recién preparada y recíbela directamente en casa.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "La Cocina de Miguelón",
      description: "Comida casera preparada con cariño y entrega a domicilio.",
      images: [{ url: new URL("/og.png", metadataBase).toString(), width: 1732, height: 909, alt: "La Cocina de Miguelón — comida casera a domicilio" }],
      locale: "es_CU",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "La Cocina de Miguelón",
      description: "Comida casera preparada con cariño y entrega a domicilio.",
      images: [new URL("/og.png", metadataBase).toString()],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={geist.variable}>{children}</body>
    </html>
  );
}
