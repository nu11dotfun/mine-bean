/**
 * BEAN Private Deploys — ZK circuits / SDK loading
 *
 * Everything heavy is lazy:
 *  - The SDK (and snarkjs inside it) is only pulled in via dynamic `import()`
 *    when proving actually starts — never in the entry bundle, never on page
 *    load.
 *  - Proving artifacts are fetched on demand from `/artifacts/*` (served with
 *    `Cache-Control: immutable`, see next.config.js) — a one-time ~20MB
 *    download per device.
 *  - Only the WITHDRAW circuit is loaded. The stock SDK `Circuits` class
 *    eagerly downloads the commitment circuit too (~3MB, only needed for
 *    ragequit, which the app does not expose yet) — `LazyCircuits` overrides
 *    that.
 *
 * `prefetchArtifacts` streams the same URLs with byte-level progress to warm
 * the browser HTTP cache, so the SDK's own fetches afterwards are instant.
 */

import type { PrivacyPoolSDK } from '@0xbow/privacy-pools-core-sdk'

/** The three files of the withdraw circuit, relative to the site origin. */
export const WITHDRAW_ARTIFACT_PATHS = [
  '/artifacts/withdraw.wasm',
  '/artifacts/withdraw.vkey',
  '/artifacts/withdraw.zkey',
] as const

let sdkPromise: Promise<PrivacyPoolSDK> | null = null

/**
 * Lazily construct the PrivacyPoolSDK singleton (browser mode). Safe to call
 * repeatedly; the dynamic import + artifact downloads happen once.
 */
export function getPrivacySdk(): Promise<PrivacyPoolSDK> {
  if (!sdkPromise) {
    sdkPromise = (async () => {
      const sdk = await import('@0xbow/privacy-pools-core-sdk')

      // Subclass defined inside the dynamic import so the SDK stays out of
      // the entry bundle. Overrides the eager all-circuits download with a
      // withdraw-only one.
      class LazyCircuits extends sdk.Circuits {
        // prettier-ignore
        override async downloadArtifacts(): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
          const withdraw = await this._downloadCircuitArtifacts('withdraw')
          return { withdraw }
        }
      }

      const circuits = new LazyCircuits({
        baseUrl: `${window.location.origin}/`,
        browser: true,
      })
      return new sdk.PrivacyPoolSDK(circuits)
    })()
    // Allow a retry if the import or first artifact fetch fails.
    sdkPromise.catch(() => {
      sdkPromise = null
    })
  }
  return sdkPromise
}

export interface ArtifactProgress {
  /** Bytes received across all files so far. */
  loadedBytes: number
  /** Total bytes across all files (0 until Content-Length headers arrive). */
  totalBytes: number
  /** Files fully downloaded. */
  filesDone: number
  filesTotal: number
}

let prefetchPromise: Promise<void> | null = null

/**
 * Download the withdraw artifacts with byte-level progress, warming the HTTP
 * cache so the SDK's own fetches hit it instantly. One-time per device thanks
 * to the immutable cache headers; subsequent calls are no-ops within the
 * session and near-instant across sessions.
 */
export function prefetchArtifacts(
  onProgress?: (p: ArtifactProgress) => void
): Promise<void> {
  if (!prefetchPromise) {
    prefetchPromise = (async () => {
      const sizes = new Array(WITHDRAW_ARTIFACT_PATHS.length).fill(0)
      const loaded = new Array(WITHDRAW_ARTIFACT_PATHS.length).fill(0)
      let filesDone = 0

      const report = () =>
        onProgress?.({
          loadedBytes: loaded.reduce((a, b) => a + b, 0),
          totalBytes: sizes.reduce((a, b) => a + b, 0),
          filesDone,
          filesTotal: WITHDRAW_ARTIFACT_PATHS.length,
        })

      await Promise.all(
        WITHDRAW_ARTIFACT_PATHS.map(async (path, i) => {
          const res = await fetch(path)
          if (!res.ok) throw new Error(`artifact fetch failed: ${path} (${res.status})`)
          sizes[i] = Number(res.headers.get('content-length') ?? 0)
          report()
          if (res.body) {
            const reader = res.body.getReader()
            for (;;) {
              const { done, value } = await reader.read()
              if (done) break
              loaded[i] += value.byteLength
              report()
            }
          } else {
            loaded[i] = (await res.arrayBuffer()).byteLength
          }
          filesDone += 1
          report()
        })
      )
    })()
    prefetchPromise.catch(() => {
      prefetchPromise = null
    })
  }
  return prefetchPromise
}
