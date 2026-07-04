/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    cpus: 2,
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
