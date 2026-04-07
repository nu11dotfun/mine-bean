export interface AgentMeta {
  id: string
  apiAgentId: string // backend payout system ID
  name: string
  strategy: string
  strategyDetail: string
  walletAddress: string
  vaultAddress?: `0x${string}` // vault contract for investing
  oldVaultAddress?: `0x${string}` // previous vault contract (for legacy withdrawals)
  status: 'active' | 'paused' | 'new'
}

// BEAN paid to holders before community voted 100% burn (pre-March 23 2026)
// Subtract from totalBeanPaidOut to get actual BEAN burnt
export const PRE_BURN_HOLDER_PAYOUTS = 395
export const PRE_BURN_PER_AGENT: Record<string, number> = {
  antiwinner: 252.3,
  hunter: 76.5,
  sniper: 67.45,
}

export const AGENTS: AgentMeta[] = [
  {
    id: 'agent1',
    apiAgentId: 'antiwinner',
    name: 'Anti-Winner',
    strategy: 'Deploys to all 24 blocks except the previous round\'s winner',
    strategyDetail: 'Deploys to all 24 blocks except the previous round\'s winner. 96% win probability. Optimal sizing formula adjusts based on grid activity. High frequency, steady BEAN accumulation.',
    walletAddress: '0x3f2E4985e13E786e80A177E5984787F05C859634',
    vaultAddress: '0x3f2E4985e13E786e80A177E5984787F05C859634',
    oldVaultAddress: '0x6F57a1063833282E7C1cC1F43a54C6362B807FEc',
    status: 'active',
  },
  {
    id: 'agent2',
    apiAgentId: 'hunter',
    name: 'Beanpot Hunter',
    strategy: 'Deploys to all 25 blocks, ramps up bets as the beanpot grows.',
    strategyDetail: 'Deploys to all 25 blocks at minimum. Waits for the pot to build, then scales up deployment as it approaches the historical beanpot max. The strategy isn\'t per-round, it\'s hunting the jackpot. Expected ~78 BEAN per hit at 1/777 odds.',
    walletAddress: '0xaaCf48cDE365c754874526D365402a7e3dbb0C88',
    vaultAddress: '0xaaCf48cDE365c754874526D365402a7e3dbb0C88',
    oldVaultAddress: '0xF6458A627eA93dee0c29A4A6b94b3e202875C208',
    status: 'active',
  },
  {
    id: 'agent3',
    apiAgentId: 'sniper',
    name: 'Sniper',
    strategy: 'Deploys to all 25 blocks as late as possible, only if EV is positive.',
    strategyDetail: 'Waits until seconds before round end to see the final grid state, then decides whether to deploy or skip entirely based on an EV formula. Adaptive timing targets the latest safe window before round close. Skips any round where the grid is too full for positive EV.',
    walletAddress: '0xeA6f4ae6f6436Cedc9E9bDbcb9688ec8f771EFB2',
    vaultAddress: '0xeA6f4ae6f6436Cedc9E9bDbcb9688ec8f771EFB2',
    oldVaultAddress: '0x29bbD4445BA27002D688bdB1FF652A67fA8f24ce',
    status: 'active',
  },
  {
    id: 'agent4',
    apiAgentId: 'anti-loser',
    name: 'Anti-Loser',
    strategy: 'Deploys to 24 blocks, skipping the coldest block over the last 100 rounds.',
    strategyDetail: 'Deploys to 24 out of 25 blocks, skipping the coldest block over the last 100 rounds. Calculates deployment amount and only deploys when EV is positive, otherwise skips the round entirely.',
    walletAddress: '0xCfed0969a7D638cBe23Ff01C2C795d2D39C60887',
    status: 'active',
  },
]
