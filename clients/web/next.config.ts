import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    position: "bottom-right",
  },
  // The dev stack is published on all interfaces so other machines on the LAN
  // can open it. Next blocks cross-origin requests to /_next dev resources by
  // default, which would serve the HTML but none of the chunks. Allow the
  // private ranges instead of one hard-coded address, since the dev host and
  // its Docker port differ per machine and per worktree.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*"],
  // Admin settings used to be one page; bookmarks to it land on the first admin page now.
  async redirects() {
    return [{ source: "/admin/settings", destination: "/admin/users", permanent: false }];
  },
};

export default nextConfig;
