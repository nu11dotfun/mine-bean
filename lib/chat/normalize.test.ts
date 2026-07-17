import { describe, it, expect } from 'vitest'
import {
  normalizeForms,
  matchBlocklist,
  detectLink,
  type BlockPattern,
} from './normalize'

const BLOCK: BlockPattern[] = [
  { pattern: 'fuck', mode: 'block', is_regex: false },
  { pattern: 'ass', mode: 'block', is_regex: false },
  { pattern: 'free money', mode: 'block', is_regex: false },
  { pattern: 'airdrop', mode: 'flag', is_regex: false },
]
const NO_ALLOW = new Set<string>()

const match = (text: string, patterns = BLOCK, allow = NO_ALLOW) =>
  matchBlocklist(text, normalizeForms(text), patterns, allow)

describe('normalizeForms', () => {
  it('produces spaced, squashed and deduped forms', () => {
    expect(normalizeForms('f.u.c.k you')).toEqual({
      spaced: 'f u c k you',
      squashed: 'fuckyou',
      squashedDedup: 'fuckyou',
    })
  })

  it('collapses repeated characters', () => {
    expect(normalizeForms('fuuuuck').squashed).toBe('fuck')
  })
})

describe('matchBlocklist — evasion', () => {
  it('matches the plain word', () => {
    expect(match('well fuck')?.pattern).toBe('fuck')
  })

  it('matches dotted separation f.u.c.k', () => {
    expect(match('f.u.c.k')?.pattern).toBe('fuck')
  })

  it('matches spaced-out f u c k', () => {
    expect(match('f u c k')?.pattern).toBe('fuck')
  })

  it('matches Greek-upsilon homoglyph fυck', () => {
    expect(match('fυck')?.pattern).toBe('fuck')
  })

  it('matches Cyrillic homoglyphs', () => {
    // а and с are Cyrillic
    expect(match('аss', [{ pattern: 'ass', mode: 'block', is_regex: false }])?.pattern).toBe('ass')
  })

  it('matches zero-width-split words', () => {
    expect(match('fu\u200bck')?.pattern).toBe('fuck')
  })

  it('matches leetspeak', () => {
    expect(match('fuck1ng')?.pattern).toBe('fuck')
    expect(match('a55', [{ pattern: 'ass', mode: 'block', is_regex: false }])?.pattern).toBe('ass')
  })

  it('matches elongation and doubled letters', () => {
    expect(match('FUUUUCK')?.pattern).toBe('fuck')
    expect(match('ffuucckk')?.pattern).toBe('fuck')
  })

  it('matches uppercase', () => {
    expect(match('FUCK')?.pattern).toBe('fuck')
  })

  it('matches multi-word phrases', () => {
    expect(match('claim your free   money now')?.pattern).toBe('free money')
  })

  it('returns flag mode for flag patterns', () => {
    expect(match('big airdrop coming')?.mode).toBe('flag')
  })

  it('prefers block hits over flag hits', () => {
    expect(match('airdrop fuck')?.mode).toBe('block')
  })
})

describe('matchBlocklist — false positives', () => {
  it('does not fire short patterns inside longer words (passed vs ass)', () => {
    expect(match('we passed the round')).toBeNull()
    expect(match('massive win')).toBeNull()
    expect(match('classic')).toBeNull()
  })

  it('still catches the short pattern standalone', () => {
    expect(match('what an ass')?.pattern).toBe('ass')
  })

  it('allowlist kills Scunthorpe-style false positives', () => {
    const cuntBlock: BlockPattern[] = [{ pattern: 'cunt', mode: 'block', is_regex: false }]
    expect(match('greetings from scunthorpe', cuntBlock)).not.toBeNull()
    expect(match('greetings from scunthorpe', cuntBlock, new Set(['scunthorpe']))).toBeNull()
  })

  it('leaves clean messages alone', () => {
    expect(match('gm miners, huge round')).toBeNull()
    expect(match('deployed 0.5 eth on block 14')).toBeNull()
  })
})

describe('matchBlocklist — regex patterns', () => {
  it('supports regex mode', () => {
    const rx: BlockPattern[] = [{ pattern: 'n+[i1]+g+[e3]+r+', mode: 'block', is_regex: true }]
    expect(matchBlocklist('n1gger', normalizeForms('n1gger'), rx, NO_ALLOW)).not.toBeNull()
  })

  it('never throws on an invalid regex from the dashboard', () => {
    const bad: BlockPattern[] = [{ pattern: '([unclosed', mode: 'block', is_regex: true }]
    expect(() => matchBlocklist('hello', normalizeForms('hello'), bad, NO_ALLOW)).not.toThrow()
  })
})

describe('detectLink', () => {
  it.each([
    'check https://scam.com',
    'http://x.co/a',
    'go to www.foo.io now',
    'minebean.com',
    'buy at sc4m.xyz',
    'minebean dot com',
    'minebean [.] com',
    'minebean(.)com',
    'minebean。com',
    'airdrop-claim.finance',
  ])('flags %s', (text) => {
    expect(detectLink(text)).toBe(true)
  })

  it.each([
    'gm miners',
    'done. today was huge',
    'nice. come on',
    'deployed 0.5 eth',
    'price hit 4.20 today',
    'ok. one more round',
    'v1.5 is live',
    'that round paid 3.5x',
  ])('does not flag %s', (text) => {
    expect(detectLink(text)).toBe(false)
  })
})
