// Client fetcher for Dune query results, served by the same-origin proxy at
// /api/dune (which holds the Dune API key server-side). Add new queries to the
// whitelist in app/api/dune/route.ts, then request them here by name.

export interface DuneResponse<T = Record<string, unknown>> {
  rows: T[]
  rowCount: number
  executedAt: string | null
}

export async function fetchDune<T = Record<string, unknown>>(q: string): Promise<DuneResponse<T> | null> {
  try {
    const res = await fetch(`/api/dune?q=${encodeURIComponent(q)}`)
    if (!res.ok) return null
    return (await res.json()) as DuneResponse<T>
  } catch {
    return null
  }
}
