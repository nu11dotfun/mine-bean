import GridMiningABI from './abis/GridMining.json'
import AutoMinerABI from './abis/AutoMiner.json'
import BeanABI from './abis/Bean.json'
import TreasuryABI from './abis/Treasury.json'
import StakingABI from './abis/Staking.json'

export const CONTRACTS = {
  GridMining: {
    address: '0xcc9dA9277D83A0b17B555246DaBF7dA9a3d5c9f0' as `0x${string}`,
    abi: GridMiningABI,
  },
  Bean: {
    address: '0xBe4764ccE14B7BF478597AA00F5f6A5D42547925' as `0x${string}`,
    abi: BeanABI,
  },
  AutoMiner: {
    address: '0x442714CcFf3f0C851A16cA9B3733cd58951389e1' as `0x${string}`,
    abi: AutoMinerABI,
  },
  Treasury: {
    address: '0x0093DB20543d17F294F58432D08c4FA47C70dfe9' as `0x${string}`,
    abi: TreasuryABI,
  },
  LP: {
    address: '0x7e58f160b5b77b8b24cd9900c09a3e730215ac47' as `0x${string}`,
  },
  Staking: {
    address: '0x3bf1F3dA47061eF07423750879FE9ccB2d484b95' as `0x${string}`,
    abi: StakingABI,
  },
} as const

// Below values are used by frontend validations to avoid users submitting tx's that will revert due to contract limits.
// Make sure they reflect the true contract values.
export const MIN_DEPLOY_PER_BLOCK = 0.00001 // BNB
export const EXECUTOR_FEE_BPS = 100 // 1% AutoMiner executor fee
