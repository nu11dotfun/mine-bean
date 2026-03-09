export interface AgentMeta {
  id: string
  name: string
  strategy: string
  strategyDetail: string
  walletAddress: string
  status: 'active' | 'paused' | 'new'
}

export const AGENTS: AgentMeta[] = [
  {
    id: 'agent1',
    name: 'Anti-Winner',
    strategy: 'Deploys to all 24 blocks except the previous round\'s winner',
    strategyDetail: 'Deploys to all 24 blocks except the previous round\'s winner. 96% win probability. Optimal sizing formula adjusts based on grid activity. High frequency, steady BEAN accumulation.',
    walletAddress: '0x8A4ca6c796fD765537Fa367f1557bcF5Dc48C73d',
    status: 'active',
  },
  {
    id: 'agent2',
    name: 'Hot-Blocks',
    strategy: 'Snipes statistically anomalous high-frequency blocks',
    strategyDetail: 'Tracks winning block frequency over ~100 rounds and only deploys to statistically anomalous blocks. When it does deploy, ETH is concentrated on 1-3 blocks on average so it\'s a lower win frequency and higher payout per win.',
    walletAddress: '0xc275729A64D5EF11fE5181D929047D4f16326BDF',
    status: 'active',
  },
  {
    id: 'agent3',
    name: 'Beanpot Hunter',
    strategy: 'Deploys to all 25 blocks, ramps up bets as the beanpot grows.',
    strategyDetail: 'Deploys to all 25 blocks at minimum. Waits for the pot to build, then scales up deployment as it approaches the historical beanpot max. The strategy isn\'t per-round, it\'s hunting the jackpot. Expected ~233 BEAN per hit at 1/777 odds.',
    walletAddress: '0x0d2bD39Dc8C3E8F6b2Bcf141D2a08F05C377bdBf',
    status: 'active',
  },
]
