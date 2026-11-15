import type { NextConfig } from 'next';

// `standalone` is what the Docker runtime stage copies: Next traces the files it
// actually needs, so the runtime image carries no build tooling.
const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Clickjacking protection. SAMEORIGIN rather than DENY so our own
          // tooling can frame the site; `frame-ancestors` is the modern form and
          // is what browsers honour when both are present.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // The service worker must never be served stale, or an old shell sticks.
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ];
  },
};

export default nextConfig;
