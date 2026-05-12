import path from "path"
import { fileURLToPath } from "url"
import { withSentryConfig } from "@sentry/nextjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
  images: {
    unoptimized: true,
  },
  transpilePackages: ["canvg", "jspdf", "html2canvas"],
}

export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  hideSourceMaps: true,
})
