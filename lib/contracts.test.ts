/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest'
import { CONTRACTS, MIN_DEPLOY_PER_BLOCK, EXECUTOR_FEE_BPS } from './contracts'

describe('contracts', () => {
  it('exports valid contract addresses', () => {
    const entries = Object.entries(CONTRACTS)
    expect(entries.length).toBeGreaterThan(0)

    for (const [name, contract] of entries) {
      expect(contract.address).toMatch(/^0x[a-fA-F0-9]+$/)
      expect(contract.address.length).toBeGreaterThanOrEqual(42)
      if (name !== 'LP') {
        expect((contract as any).abi).toBeDefined()
      }
    }
  })

  it('MIN_DEPLOY_PER_BLOCK equals 0.0000025', () => {
    expect(MIN_DEPLOY_PER_BLOCK).toBe(0.0000025)
  })

  it('EXECUTOR_FEE_BPS equals 100 (1%)', () => {
    expect(EXECUTOR_FEE_BPS).toBe(100)
  })

  it('LP contract has no abi', () => {
    expect(CONTRACTS.LP).toBeDefined()
    expect(CONTRACTS.LP.address).toBeDefined()
    expect((CONTRACTS.LP as any).abi).toBeUndefined()
  })
})
