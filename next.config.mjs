/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone-free: we run `next start` from the runner stage, so the full
  // .next build output is copied into the image (see docker/Dockerfile).
  poweredByHeader: false,

  // Embedded apps render inside an admin.shopify.com iframe. Next sets no
  // frame-ancestors of its own, but some hosts inject X-Frame-Options: DENY,
  // which browsers honour over CSP and blanks the app. Neutralise it here and
  // let the per-request frame-ancestors CSP (middleware.ts) be authoritative.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'X-Frame-Options', value: '' }],
      },
    ];
  },
};

export default nextConfig;
