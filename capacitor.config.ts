/// <reference types="@capacitor/local-notifications" />

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tusalon.romamenu.admin",
  appName: "Miguelón Admin",
  webDir: "dist/client",
  backgroundColor: "#fbf5ea",
  server: {
    androidScheme: "https",
    appStartPath: "/admin/",
  },
  plugins: {
    LocalNotifications: {
      iconColor: "#8f241f",
    },
  },
};

export default config;
