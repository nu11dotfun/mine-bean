// All-time mining activity from the Dune mining-volume query, for the Mining
// hero cards (total deploys, total ETH, average deploy size).

import { useEffect, useState } from 'react'
import { fetchDune } from './duneData'

export interface MiningStats {
  deployments: number
  totalEth: number
  avgEthPerDeploy: number
}

let cache: MiningStats | null = null

export function useMiningStats(): MiningStats | null {
  const [stats, setStats] = useState<MiningStats | null>(cache)
  useEffect(() => {
    if (cache) return
    let cancelled = false
    fetchDune<{ num_deployments?: number | string; total_eth_deployed?: number | string }>('mining-volume').then((r) => {
      if (cancelled || !r) return
      const n = (v: unknown) => (typeof v === 'string' ? parseFloat(v) : (v as number)) || 0
      let deployments = 0
      let totalEth = 0
      for (const x of r.rows) {
        deployments += n(x.num_deployments)
        totalEth += n(x.total_eth_deployed)
      }
      cache = { deployments, totalEth, avgEthPerDeploy: deployments ? totalEth / deployments : 0 }
      setStats(cache)
    })
    return () => { cancelled = true }
  }, [])
  return stats
}
