import type { Metadata } from "next";
import { OrderTracking } from "@/app/components/OrderTracking";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Sigue tu pedido",
  // Cada enlace es de un cliente: no tiene sentido que lo indexe un buscador.
  robots: { index: false, follow: false },
};

export default function OrderTrackingPage() {
  return <OrderTracking />;
}
