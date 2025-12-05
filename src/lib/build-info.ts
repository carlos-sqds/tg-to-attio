// Build info - populated at build time via next.config.ts
export const BUILD_INFO = {
  commitHash: process.env.NEXT_PUBLIC_COMMIT_HASH || "dev",
  commitHashShort: (process.env.NEXT_PUBLIC_COMMIT_HASH || "dev").substring(0, 7),
  buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString(),
};
