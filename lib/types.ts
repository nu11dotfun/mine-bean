// Custom window event types for cross-component communication

export interface RoundData {
  roundId: string
  startTime: number
  endTime: number
  beanpotPoolFormatted: string
  totalDeployedFormatted: string
  userDeployedFormatted?: string
  blocks?: Array<{ id: number; deployed: string; deployedFormatted: string; minerCount: number }>
}

export interface RoundSettledEvent {
  roundId: string
  winningBlock: number
  topMiner: string
  totalWinnings: string
  topMinerReward: string
  beanpotAmount: string
  isSplit: boolean
}

export interface RoundDeployedEvent {
  totalDeployed: string
  totalDeployedFormatted: string
  user: string
  userDeployedFormatted: string
}

export interface BlocksChangedEvent {
  blocks: number[]
  count: number
}

export interface SelectAllBlocksEvent {
  selectAll: boolean
}

export interface UserDeployedEvent {
  blockIds: number[]
}

export interface AutoMinerModeEvent {
  enabled: boolean
  strategy: string | null
}

// Combined round transition event (replaces separate roundSettled + gameStarted)
export interface RoundTransitionEvent {
  settled: RoundSettledEvent | null  // null for empty rounds
  newRound: {
    roundId: string
    startTime: number
    endTime: number
    beanpotPool: string
    beanpotPoolFormatted: string
  }
}

// Extend the global WindowEventMap for typed event listeners
declare global {
  interface WindowEventMap {
    roundData: CustomEvent<RoundData>
    roundSettled: CustomEvent<RoundSettledEvent>
    roundDeployed: CustomEvent<RoundDeployedEvent>
    roundTransition: CustomEvent<RoundTransitionEvent>
    blocksChanged: CustomEvent<BlocksChangedEvent>
    selectAllBlocks: CustomEvent<SelectAllBlocksEvent>
    userDeployed: CustomEvent<UserDeployedEvent>
    settlementComplete: CustomEvent<void>
    autoMinerMode: CustomEvent<AutoMinerModeEvent>
    autoMinerActivated: CustomEvent<void>
    autoMinerStopped: CustomEvent<void>
  }
}

// This export is needed to make this a module
export {}
