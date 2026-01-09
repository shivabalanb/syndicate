/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    styledComponents: true
  },
  async rewrites() {
    return [
      {
        source: '/api/casper-rpc/rpc', 
        destination: 'http://176.9.53.142:7777/rpc' 
      }
    ];
  }
};

export default nextConfig;
