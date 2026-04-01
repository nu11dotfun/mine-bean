import GridMiningABI from './abis/GridMining.json'
import AutoMinerABI from './abis/AutoMiner.json'
import BeanABI from './abis/Bean.json'
import TreasuryABI from './abis/Treasury.json'
import StakingABI from './abis/Staking.json'
import AgentVaultABI from './abis/AgentVault.json'

export const CONTRACTS = {
  GridMining: {
    address: '0x9632495bDb93FD6B0740Ab69cc6c71C9c01da4f0' as `0x${string}`,
    abi: GridMiningABI,
  },
  Bean: {
    address: '0x5c72992b83E74c4D5200A8E8920fB946214a5A5D' as `0x${string}`,
    abi: BeanABI,
  },
  AutoMiner: {
    address: '0x31358496900D600B2f523d6EdC4933E78F72De89' as `0x${string}`,
    abi: AutoMinerABI,
  },
  Treasury: {
    address: '0x38F6E74148D6904286131e190d879A699fE3Aeb3' as `0x${string}`,
    abi: TreasuryABI,
  },
  LP: {
    address: '0xd7e5522c9cc3682c960afada6adde0f8116580f2ad2cef08c197faf625e53842' as `0x${string}`,
  },
  Staking: {
    address: '0xfe177128Df8d336cAf99F787b72183D1E68Ff9c2' as `0x${string}`,
    abi: StakingABI,
  },
  AgentVault: {
    abi: AgentVaultABI, // Each agent has its own vault address — see agents.ts vaultAddress field
  },
} as const

// Below values are used by frontend validations to avoid users submitting tx's that will revert due to contract limits.
// Make sure they reflect the true contract values.
export const MIN_DEPLOY_PER_BLOCK = 0.0000025 // ETH
export const EXECUTOR_FEE_BPS = 100 // 1% AutoMiner executor fee
export const EXECUTOR_FLAT_FEE = 0.000006 // ETH per round — fee floor for AutoMiner

// ERC-8021 Builder Code attribution suffix (bc_rudgiazu)
export const BUILDER_CODE_SUFFIX = '0x62635f7275646769617a750b0080218021802180218021802180218021' as `0x${string}`
