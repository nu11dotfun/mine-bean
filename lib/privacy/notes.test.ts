import { describe, it, expect, beforeEach } from 'vitest'
import type { Address } from 'viem'
import {
  type PrivateNote,
  loadNotes,
  addNote,
  markSpent,
  getUnspentNote,
  getUnspentCashoutNote,
  notePurpose,
  nextDepositIndex,
  replaceNotes,
  loadCachedSubaccountAddress,
  saveCachedSubaccountAddress,
  hasExportedKey,
  markExported,
} from './notes'

const MAIN = '0xAbC0000000000000000000000000000000000001' as Address
const OTHER = '0xAbC0000000000000000000000000000000000002' as Address

const note = (overrides: Partial<PrivateNote> = {}): PrivateNote => ({
  label: '111',
  value: '1000000000000000',
  commitment: '222',
  depositIndex: 0,
  spent: false,
  txHash: '0xabc',
  createdAt: 1700000000000,
  ...overrides,
})

beforeEach(() => {
  window.localStorage.clear()
})

describe('note store', () => {
  it('starts empty and round-trips a note', () => {
    expect(loadNotes(MAIN)).toEqual([])
    addNote(MAIN, note())
    expect(loadNotes(MAIN)).toEqual([note()])
  })

  it('serializes strings only — no BigInt in storage', () => {
    addNote(MAIN, note())
    const raw = window.localStorage.getItem(
      `bean_privacy_notes_v1_${MAIN.toLowerCase()}`
    )
    expect(raw).toBeTruthy()
    expect(() => JSON.parse(raw!)).not.toThrow()
  })

  it('keys notes per main address (lowercased)', () => {
    addNote(MAIN, note())
    expect(loadNotes(OTHER)).toEqual([])
    expect(loadNotes(MAIN.toLowerCase() as Address)).toEqual([note()])
  })

  it('ignores duplicate labels', () => {
    addNote(MAIN, note())
    addNote(MAIN, note({ value: '999' }))
    expect(loadNotes(MAIN)).toHaveLength(1)
    expect(loadNotes(MAIN)[0].value).toBe('1000000000000000')
  })

  it('markSpent flips only the matching note', () => {
    addNote(MAIN, note())
    addNote(MAIN, note({ label: '333', depositIndex: 1 }))
    markSpent(MAIN, '111')
    const notes = loadNotes(MAIN)
    expect(notes.find((n) => n.label === '111')?.spent).toBe(true)
    expect(notes.find((n) => n.label === '333')?.spent).toBe(false)
  })

  it('getUnspentNote returns the live note, none when all spent', () => {
    expect(getUnspentNote(MAIN)).toBeUndefined()
    addNote(MAIN, note())
    expect(getUnspentNote(MAIN)?.label).toBe('111')
    markSpent(MAIN, '111')
    expect(getUnspentNote(MAIN)).toBeUndefined()
  })

  it('nextDepositIndex is per-pool: 0 when empty, max+1 otherwise', () => {
    expect(nextDepositIndex(MAIN, 'eth')).toBe(0)
    addNote(MAIN, note({ depositIndex: 0 }))
    expect(nextDepositIndex(MAIN, 'eth')).toBe(1)
    addNote(MAIN, note({ label: '333', depositIndex: 4 }))
    expect(nextDepositIndex(MAIN, 'eth')).toBe(5)
    // BEAN pool keeps an independent sequence (untagged notes are eth).
    expect(nextDepositIndex(MAIN, 'bean')).toBe(0)
    addNote(MAIN, note({ label: 'b1', depositIndex: 0, pool: 'bean' }))
    expect(nextDepositIndex(MAIN, 'bean')).toBe(1)
    expect(nextDepositIndex(MAIN, 'eth')).toBe(5)
  })

  it('replaceNotes overwrites the set (recovery rescan)', () => {
    addNote(MAIN, note())
    replaceNotes(MAIN, [note({ label: '999', spent: true })])
    expect(loadNotes(MAIN)).toHaveLength(1)
    expect(loadNotes(MAIN)[0].label).toBe('999')
  })

  it('survives corrupted storage', () => {
    window.localStorage.setItem(
      `bean_privacy_notes_v1_${MAIN.toLowerCase()}`,
      'not-json'
    )
    expect(loadNotes(MAIN)).toEqual([])
  })
})

describe('cached subaccount address', () => {
  it('round-trips per main address', () => {
    expect(loadCachedSubaccountAddress(MAIN)).toBeNull()
    saveCachedSubaccountAddress(MAIN, OTHER)
    expect(loadCachedSubaccountAddress(MAIN)).toBe(OTHER)
    expect(loadCachedSubaccountAddress(OTHER)).toBeNull()
  })
})

describe('export-key flag', () => {
  it('defaults false, sets true via markExported, scoped per main address', () => {
    expect(hasExportedKey(MAIN)).toBe(false)
    markExported(MAIN)
    expect(hasExportedKey(MAIN)).toBe(true)
    expect(hasExportedKey(OTHER)).toBe(false)
  })
})

describe('purpose / depositor tagging', () => {
  it('round-trips the new fields', () => {
    addNote(MAIN, note({ purpose: 'cashout', depositor: 'subaccount' }))
    const stored = loadNotes(MAIN)[0]
    expect(stored.purpose).toBe('cashout')
    expect(stored.depositor).toBe('subaccount')
  })

  it('notePurpose defaults legacy untagged notes to funding', () => {
    expect(notePurpose(note())).toBe('funding')
    expect(notePurpose(note({ purpose: 'cashout' }))).toBe('cashout')
  })

  it('getUnspentNote returns funding notes only, excluding cashout', () => {
    addNote(MAIN, note({ label: 'c1', purpose: 'cashout', depositor: 'subaccount' }))
    expect(getUnspentNote(MAIN)).toBeUndefined()
    addNote(MAIN, note({ label: 'f1', depositIndex: 1 })) // untagged → funding
    expect(getUnspentNote(MAIN)?.label).toBe('f1')
  })

  it('getUnspentCashoutNote returns the in-flight cashout note per pool', () => {
    expect(getUnspentCashoutNote(MAIN, 'eth')).toBeUndefined()
    // Untagged cashout note ≡ eth pool.
    addNote(MAIN, note({ label: 'c1', purpose: 'cashout' }))
    expect(getUnspentCashoutNote(MAIN, 'eth')?.label).toBe('c1')
    expect(getUnspentCashoutNote(MAIN, 'bean')).toBeUndefined()
    // A BEAN cashout is independent.
    addNote(MAIN, note({ label: 'cb', purpose: 'cashout', pool: 'bean' }))
    expect(getUnspentCashoutNote(MAIN, 'bean')?.label).toBe('cb')
    markSpent(MAIN, 'c1')
    expect(getUnspentCashoutNote(MAIN, 'eth')).toBeUndefined()
    expect(getUnspentCashoutNote(MAIN, 'bean')?.label).toBe('cb')
  })
})
