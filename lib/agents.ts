export interface AgentMeta {
  id: string
  apiAgentId: string // backend payout system ID
  name: string
  strategy: string
  strategyDetail: string
  walletAddress: string
  vaultAddress?: `0x${string}` // vault contract for investing
  status: 'active' | 'paused' | 'new'
  initialFunding: number // ETH
}

// BEAN paid to holders before community voted 100% burn (pre-March 23 2026)
// Subtract from totalBeanPaidOut to get actual BEAN burnt
export const PRE_BURN_HOLDER_PAYOUTS = 395
export const PRE_BURN_PER_AGENT: Record<string, number> = {
  antiwinner: 252.3,
  hotblocks: 0,
  hunter: 76.5,
  sniper: 67.45,
  regression: 0,
}

export const AGENTS: AgentMeta[] = [
  {
    id: 'agent1',
    apiAgentId: 'antiwinner',
    name: 'Anti-Winner',
    strategy: 'Deploys to all 24 blocks except the previous round\'s winner',
    strategyDetail: 'Deploys to all 24 blocks except the previous round\'s winner. 96% win probability. Optimal sizing formula adjusts based on grid activity. High frequency, steady BEAN accumulation.',
    walletAddress: '0x6F57a1063833282E7C1cC1F43a54C6362B807FEc',
    vaultAddress: '0x6F57a1063833282E7C1cC1F43a54C6362B807FEc',
    status: 'active',
    initialFunding: 1.0,
  },
  {
    id: 'agent2',
    apiAgentId: 'hotblocks',
    name: 'Hot-Blocks',
    strategy: 'Snipes statistically anomalous high-frequency blocks',
    strategyDetail: 'Tracks winning block frequency over ~100 rounds and only deploys to statistically anomalous blocks. When it does deploy, ETH is concentrated on 1-3 blocks on average so it\'s a lower win frequency and higher payout per win.',
    walletAddress: '0xc275729A64D5EF11fE5181D929047D4f16326BDF',
    status: 'active',
    initialFunding: 1.0,
  },
  {
    id: 'agent3',
    apiAgentId: 'hunter',
    name: 'Beanpot Hunter',
    strategy: 'Deploys to all 25 blocks, ramps up bets as the beanpot grows.',
    strategyDetail: 'Deploys to all 25 blocks at minimum. Waits for the pot to build, then scales up deployment as it approaches the historical beanpot max. The strategy isn\'t per-round, it\'s hunting the jackpot. Expected ~233 BEAN per hit at 1/777 odds.',
    walletAddress: '0xF6458A627eA93dee0c29A4A6b94b3e202875C208',
    vaultAddress: '0xF6458A627eA93dee0c29A4A6b94b3e202875C208',
    status: 'active',
    initialFunding: 1.0,
  },
  {
    id: 'agent4',
    apiAgentId: 'sniper',
    name: 'Sniper',
    strategy: 'Deploys to all 25 blocks as late as possible, only if EV is positive.',
    strategyDetail: 'Waits until seconds before round end to see the final grid state, then decides whether to deploy or skip entirely based on an EV formula. Adaptive timing targets the latest safe window before round close. Skips any round where the grid is too full for positive EV.',
    walletAddress: '0x29bbD4445BA27002D688bdB1FF652A67fA8f24ce',
    vaultAddress: '0x29bbD4445BA27002D688bdB1FF652A67fA8f24ce',
    status: 'active',
    initialFunding: 0.5,
  },
  {
    id: 'agent5',
    apiAgentId: 'regression',
    name: 'Regression Chaser',
    strategy: 'Deploys only to statistically cold blocks, sizing up based on how cold they are.',
    strategyDetail: 'Tracks block win frequency and only enters rounds where blocks are statistically overdue, defined as 2 or fewer wins when ~8 are expected, placing that outcome below 1% probability. Skips roughly 83% of rounds. When it does deploy, bet sizing scales based on the ratio of warm to cold blocks on the grid.',
    walletAddress: '0x41204E0dB0bB12c97B8DD3C71e3F946bAe00D150',
    status: 'active',
    initialFunding: 0.5,
  },
]
