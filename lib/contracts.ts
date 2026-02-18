import GridMiningABI from './abis/GridMining.json'
import AutoMinerABI from './abis/AutoMiner.json'
import BeanABI from './abis/Bean.json'
import TreasuryABI from './abis/Treasury.json'
import StakingABI from './abis/Staking.json'

export const CONTRACTS = {
  GridMining: {
    address: '0xDC5E4327F8bCF1019bfBAEcf5f606db7Ecd44Ee3' as `0x${string}`,
    abi: GridMiningABI,
  },
  Bean: {
    address: '0xDAB7B7B5f295F558dE32025873CA2F561c6512DE' as `0x${string}`,
    abi: BeanABI,
  },
  AutoMiner: {
    address: '0x0C3cf6aA29B0e1cd5a05CB77448cC3A43BE4CAf2' as `0x${string}`,
    abi: AutoMinerABI,
  },
  Treasury: {
    address: '0x4A0BCc34287769f18DB27101cE41C8EF5a25fD43' as `0x${string}`,
    abi: TreasuryABI,
  },
  LP: {
    address: '0x3e9b01e1C30ea92Adc8B02C0BCf3f0DE509aCbD3' as `0x${string}`,
  },
  Staking: {
    address: '0x4C95D7F61C8D259d1c0a9a4dA1D0d57D9388A0bB' as `0x${string}`,
    abi: StakingABI,
  },
} as const

// Below values are used by frontend validations to avoid users submitting tx's that will revert due to contract limits.
// Make sure they reflect the true contract values.
export const MIN_DEPLOY_PER_BLOCK = 0.0000025 // ETH
export const EXECUTOR_FEE_BPS = 100 // 1% AutoMiner executor fee
export const BLOCK_TIME_DRIFT_SECONDS = 1 // Base chain block.timestamp lags ~2s behind wall clock
