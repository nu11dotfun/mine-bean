export interface AgentMeta {
  agentId: string
  displayName: string
  color: string
  label: string
}

const AGENT_META: Record<string, AgentMeta> = {
  'anti-winner': { agentId: 'anti-winner', displayName: 'Anti-Winner', color: '#0052FF', label: 'AGENT_001' },
  'hot-blocks': { agentId: 'hot-blocks', displayName: 'Hot-Blocks', color: '#FF6B35', label: 'AGENT_002' },
  'beanpot-hunter': { agentId: 'beanpot-hunter', displayName: 'Beanpot Hunter', color: '#FFD700', label: 'AGENT_003' },
  'sniper': { agentId: 'sniper', displayName: 'Sniper', color: '#00E5FF', label: 'AGENT_004' },
  'regression-chaser': { agentId: 'regression-chaser', displayName: 'Regression Chaser', color: '#AA00FF', label: 'AGENT_005' },
}

const FALLBACK_META: AgentMeta = { agentId: 'unknown', displayName: 'Unknown Agent', color: '#888888', label: 'AGENT_???' }

export function getAgentMeta(agentId: string): AgentMeta {
  return AGENT_META[agentId] || { ...FALLBACK_META, agentId }
}

export function getAllAgentMeta(): AgentMeta[] {
  return Object.values(AGENT_META)
}
