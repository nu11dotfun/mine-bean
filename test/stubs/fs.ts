// Stub for node's `fs`, aliased in vitest.config.ts. The privacy-pools SDK's
// ESM build contains a dynamic `import("fs")` on its node-only artifact path,
// which vite cannot resolve in the jsdom test environment. Tests only use the
// browser path, so this is never actually called.
export default {}
