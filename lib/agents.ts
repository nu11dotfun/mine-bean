export interface AgentMeta {
  id: string
  name: string
  strategy: string
  strategyDetail: string
  walletAddress: string
  status: 'active' | 'paused' | 'new'
  initialFunding: number // ETH
}

export const AGENTS: AgentMeta[] = [
  {
    id: 'agent1',
    name: 'Anti-Winner',
    strategy: 'Deploys to all 24 blocks except the previous round\'s winner',
    strategyDetail: 'Deploys to all 24 blocks except the previous round\'s winner. 96% win probability. Optimal sizing formula adjusts based on grid activity. High frequency, steady BEAN accumulation.',
    walletAddress: '0x8A4ca6c796fD765537Fa367f1557bcF5Dc48C73d',
    status: 'active',
    initialFunding: 1.0,
  },
  {
    id: 'agent2',
    name: 'Hot-Blocks',
    strategy: 'Snipes statistically anomalous high-frequency blocks',
    strategyDetail: 'Tracks winning block frequency over ~100 rounds and only deploys to statistically anomalous blocks. When it does deploy, ETH is concentrated on 1-3 blocks on average so it\'s a lower win frequency and higher payout per win.',
    walletAddress: '0xc275729A64D5EF11fE5181D929047D4f16326BDF',
    status: 'active',
    initialFunding: 1.0,
  },
  {
    id: 'agent3',
    name: 'Beanpot Hunter',
    strategy: 'Deploys to all 25 blocks, ramps up bets as the beanpot grows.',
    strategyDetail: 'Deploys to all 25 blocks at minimum. Waits for the pot to build, then scales up deployment as it approaches the historical beanpot max. The strategy isn\'t per-round, it\'s hunting the jackpot. Expected ~233 BEAN per hit at 1/777 odds.',
    walletAddress: '0x0d2bD39Dc8C3E8F6b2Bcf141D2a08F05C377bdBf',
    status: 'active',
    initialFunding: 1.0,
  },
  {
    id: 'agent4',
    name: 'Sniper',
    strategy: 'Deploys to all 25 blocks as late as possible, only if EV is positive.',
    strategyDetail: 'Waits until seconds before round end to see the final grid state, then uses an emission-only EV formula (B=1.0, K=9.5238) to decide whether to deploy or skip entirely. An adaptive timing engine targets the latest safe offset (default 5s before end, down to 2s), adjusting based on timing success and revert rates. Skips any round where the grid is too full for positive EV. The edge: seeing the final grid state before committing, while others deploy blind mid-round.',
    walletAddress: '0x573714A0a2F530a8b850E5308AF3151C3CCEa160',
    status: 'active',
    initialFunding: 0.5,
  },
  {
    id: 'agent5',
    name: 'Regression Chaser',
    strategy: 'Deploys only to statistically cold blocks, sizing up based on how cold they are.',
    strategyDetail: 'Tracks block win frequency and only enters rounds where blocks are statistically overdue, defined as 2 or fewer wins when ~8 are expected, placing that outcome below 1% probability. Skips roughly 83% of rounds. When it does deploy, bet sizing scales based on the ratio of warm to cold blocks on the grid.',
    walletAddress: '0x41204E0dB0bB12c97B8DD3C71e3F946bAe00D150',
    status: 'active',
    initialFunding: 0.5,
  },
]
