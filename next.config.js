/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'imagedelivery.net',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // snarkjs (via @0xbow/privacy-pools-core-sdk) references node builtins it
      // never uses in the browser proof path.
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        readline: false,
        constants: false,
        os: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        // ZK proving artifacts are content-immutable; cache one download per device.
        source: '/artifacts/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/.well-known/skills/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Cache-Control', value: 'public, max-age=300' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        source: '/.well-known/skills/:path*.md',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;