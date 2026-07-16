import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "fr.noxvtc.app",
  appName: "NoX VTC",
  webDir: "www",
  server: {
    url: "https://app.noxvtc.fr",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
}

export default config
