import { apiFetch } from './api'

// Net BEAN emissions per round (dev endpoint, see analytics spec A1).
// Returns null until the backend endpoint is live so the UI can show a
// "coming online" state instead of erroring.
export interface NetEmissionPoint {
  roundId: number
  settledAt: string
  minted: number
  buybackPotential: number
  net: number
  ma20: number | null
  ma100: number | null
}

export interface NetEmissionsResponse {
  points: NetEmissionPoint[]
  meta?: {
    rounds?: number
    firstRound?: number
    lastRound?: number
    methodology?: string
    generatedAt?: string
  }
}

export async function fetchNetEmissions(limit = 2000): Promise<NetEmissionsResponse | null> {
  try {
    return await apiFetch<NetEmissionsResponse>(`/api/stats/net-emissions?limit=${limit}`)
  } catch {
    return null
  }
}
