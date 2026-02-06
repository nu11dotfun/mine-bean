import GridMiningABI from './abis/GridMining.json'
import AutoMinerABI from './abis/AutoMiner.json'
import BeanABI from './abis/Bean.json'
import TreasuryABI from './abis/Treasury.json'
import ERC20ABI from './abis/ERC20.json'

export const CONTRACTS = {
  GridMining: {
    address: '0x3fd29fd722433c0aAd30B2B62C95d6A457A87c7e' as `0x${string}`,
    abi: GridMiningABI,
  },
  Bean: {
    address: '0xBe4764ccE14B7BF478597AA00F5f6A5D42547925' as `0x${string}`,
    abi: BeanABI,
  },
  AutoMiner: {
    address: '0x29d24210cEF9a3a85ae3040f1b7f442649D16ecF' as `0x${string}`,
    abi: AutoMinerABI,
  },
  Treasury: {
    address: '0x0093DB20543d17F294F58432D08c4FA47C70dfe9' as `0x${string}`,
    abi: TreasuryABI,
  },
  BEANS: {
    address: '0x000Ae314E2A2172a039B26378814C252734f556A' as `0x${string}`,
    abi: ERC20ABI,
  },
  LP: {
    address: '0x7e58f160b5b77b8b24cd9900c09a3e730215ac47' as `0x${string}`,
  },
} as const

// Below values are used by frontend validations to avoid users submitting tx's that will revert due to contract limits.
// Make sure they reflect the true contract values.
export const MIN_DEPLOY_PER_BLOCK = 0.00001 // BNB
export const EXECUTOR_FEE_BPS = 50 // 0.5% AutoMiner executor fee
