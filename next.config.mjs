/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // Prevent ssh2 (Node.js-only) from being bundled by webpack.
  // It will be loaded at runtime from node_modules instead.
  serverExternalPackages: ['ssh2', 'node-cron', 'web-push'],
};

export default nextConfig;
