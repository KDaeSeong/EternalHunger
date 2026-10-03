/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    cpus: 2,
  },
  poweredByHeader: false,
  async headers() {
    // Baseline browser hardening. A Content-Security-Policy is not set yet because
    // games load audio/images from several sources; add one once those are listed.
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/simulation',
        destination: '/eternalhunger',
        permanent: false,
      },
      {
        source: '/games/eternal-hunger/play',
        destination: '/eternalhunger',
        permanent: false,
      },
      {
        source: '/games/myanimecraft/play',
        destination: '/myanime',
        permanent: false,
      },
      {
        source: '/games/ba-srpg/play',
        destination: '/srpg',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
