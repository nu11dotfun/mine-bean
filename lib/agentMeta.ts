export interface AgentMeta {
  agentId: string
  displayName: string
  color: string
  label: string
}

const AGENT_META: Record<string, AgentMeta> = {
  'anti-winner': { agentId: 'anti-winner', displayName: 'Anti-Winner', color: '#0052FF', label: 'AGENT_001' },
  'beanpot-hunter': { agentId: 'beanpot-hunter', displayName: 'Beanpot Hunter', color: '#FFD700', label: 'AGENT_002' },
  'sniper': { agentId: 'sniper', displayName: 'Sniper', color: '#00E5FF', label: 'AGENT_003' },
  'anti-loser': { agentId: 'anti-loser', displayName: 'Anti-Loser', color: '#FF4081', label: 'AGENT_004' },
  'nostradamus': { agentId: 'nostradamus', displayName: 'Nostradamus', color: '#9C27B0', label: 'AGENT_005' },
}

const FALLBACK_META: AgentMeta = { agentId: 'unknown', displayName: 'Unknown Agent', color: '#888888', label: 'AGENT_???' }

export function getAgentMeta(agentId: string): AgentMeta {
  return AGENT_META[agentId] || { ...FALLBACK_META, agentId }
}

export function getAllAgentMeta(): AgentMeta[] {
  return Object.values(AGENT_META)
}
