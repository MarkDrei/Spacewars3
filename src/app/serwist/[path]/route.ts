import { createSerwistRoute } from "@serwist/turbopack";

// Builds and serves the service worker (/serwist/sw.js) from src/app/sw.ts at build time.
// No extra precache entries (no offline page), so no git-based revision is needed —
// the Docker build context does not contain .git.
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
});
