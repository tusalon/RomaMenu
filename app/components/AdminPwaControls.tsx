"use client";

import { Capacitor } from "@capacitor/core";
import { Download, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { appPath } from "@/app/lib/site-path";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const ADMIN_WORKER = appPath("/admin-notifications-sw.js");
const ADMIN_SCOPE = appPath("/admin/");

export function AdminPwaControls() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIosInstall, setShowIosInstall] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    if ("serviceWorker" in navigator) {
      const registerAdminWorker = async () => {
        const expectedScope = new URL(ADMIN_SCOPE, window.location.origin).href;
        const registrations = await navigator.serviceWorker.getRegistrations();

        await Promise.all(
          registrations.map(async (registration) => {
            const workers = [registration.active, registration.waiting, registration.installing];
            const isAdminWorker = workers.some((worker) => {
              if (!worker) return false;
              try {
                return new URL(worker.scriptURL).pathname.endsWith("/admin-notifications-sw.js");
              } catch {
                return false;
              }
            });

            if (isAdminWorker && registration.scope !== expectedScope) {
              await registration.unregister();
            }
          }),
        );

        await navigator.serviceWorker.register(ADMIN_WORKER, { scope: ADMIN_SCOPE });
      };

      registerAdminWorker().catch(() => undefined);
    }

    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    if (standalone) return;

    const isIos =
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const iosDetectionFrame = window.requestAnimationFrame(() => setShowIosInstall(isIos));

    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const clearPrompt = () => setInstallPrompt(null);

    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", clearPrompt);

    return () => {
      window.cancelAnimationFrame(iosDetectionFrame);
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", clearPrompt);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  if (!installPrompt && !showIosInstall) return null;

  return (
    <>
      <button
        className="pwa-install-button"
        type="button"
        onClick={installPrompt ? install : () => setShowIosHelp((visible) => !visible)}
      >
        {installPrompt ? <Download size={17} /> : <Share2 size={17} />}
        {installPrompt ? "Instalar app" : "Cómo instalar"}
      </button>
      {showIosHelp ? (
        <div className="pwa-install-help" role="status">
          <strong>Instalar en iPhone o iPad</strong>
          En Safari, toca Compartir y después “Añadir a pantalla de inicio”.
        </div>
      ) : null}
    </>
  );
}
