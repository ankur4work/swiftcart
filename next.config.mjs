/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone-free: we run `next start` from the runner stage, so the full
  // .next build output is copied into the image (see docker/Dockerfile).
  poweredByHeader: false,

  // Type-checking and linting are NOT skipped — they have MOVED, to
  // .github/workflows/ci.yml, where they run on every push and block a merge.
  //
  // They cannot run here. `next build` performs them in a separate worker after
  // compilation, and on the deployment host — a VPS carrying ~80 containers —
  // that worker is reliably OOM-killed. The failure gives you nothing to work
  // with: compilation reports success, the log prints "Linting and checking
  // validity of types...", and then the build container dies with exit 255 and
  // no error message at all.
  //
  // Leaving them enabled therefore does not buy safety, it buys an
  // undiagnosable deploy failure. The gate is real, it just lives on a runner
  // with enough RAM to complete it.
  //
  // ⚠️ Do not turn these back on without also giving the build host more
  // memory, and do not remove the CI workflow — that is where the guarantee
  // now lives.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

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
