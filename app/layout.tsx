import type { Metadata } from "next";
import "./globals.css";

export const dynamic = "force-static";

const metadataBase = new URL(
  process.env.CAPACITOR_BUILD === "true"
    ? "https://localhost/"
    : process.env.GITHUB_PAGES === "true"
      ? "https://tusalon.github.io/RomaMenu/"
      : process.env.NEXT_PUBLIC_SITE_URL ??
        "https://roma-menu-miguelon.leetomy437.chatgpt.site/",
);

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "La Cocina de Miguelón | Comida casera a domicilio",
    template: "%s | La Cocina de Miguelón",
  },
  description: "Pide comida casera recién preparada y recíbela directamente en casa.",
  icons: {
    icon: new URL("favicon.svg", metadataBase).toString(),
    shortcut: new URL("favicon.svg", metadataBase).toString(),
  },
  openGraph: {
    title: "La Cocina de Miguelón",
    description: "Comida casera preparada con cariño y entrega a domicilio.",
    images: [{ url: new URL("og.png", metadataBase).toString(), width: 1732, height: 909, alt: "La Cocina de Miguelón — comida casera a domicilio" }],
    locale: "es_CU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "La Cocina de Miguelón",
    description: "Comida casera preparada con cariño y entrega a domicilio.",
    images: [new URL("og.png", metadataBase).toString()],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
