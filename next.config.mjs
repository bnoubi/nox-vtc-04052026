/** @type {import('next').NextConfig} */

const nextConfig = {
  images: {
    unoptimized: true,
  },
  transpilePackages: ["canvg", "jspdf", "html2canvas"],
}

export default nextConfig
