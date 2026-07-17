// Text normalization + blocklist matching for chat moderation.
//
// A raw blocklist is trivially evaded ("f.u.c.k", "fυck" with a Greek upsilon,
// "f u c k", zero-width joiners). Everything here exists to collapse those
// variants onto the same canonical string before any pattern is compared.
//
// Pure functions, no I/O — unit tested in normalize.test.ts.

export interface NormalForms {
  /** Letters/digits with word gaps preserved: "f.u.c.k you" → "f u c k you" */
  spaced: string
  /** All separators stripped: "f.u.c.k" → "fuck" */
  squashed: string
  /** Squashed with consecutive duplicates collapsed: "ffuucckk" → "fuck" */
  squashedDedup: string
}

export interface BlockPattern {
  pattern: string
  mode: 'block' | 'flag'
  is_regex: boolean
}

// Zero-width characters and variation selectors used to split words invisibly.
const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF\uFE00-\uFE0F]/g

// Common lookalike characters (Cyrillic/Greek/Latin-extended) → ASCII.
const HOMOGLYPHS: Record<string, string> = {
  // Cyrillic
  а: 'a', в: 'b', с: 'c', е: 'e', ё: 'e', і: 'i', ї: 'i', ј: 'j', к: 'k', м: 'm',
  н: 'h', о: 'o', р: 'p', ѕ: 's', т: 't', у: 'y', х: 'x', ԁ: 'd', ԛ: 'q', ԝ: 'w',
  // Greek
  α: 'a', β: 'b', ε: 'e', ι: 'i', κ: 'k', ν: 'v', ο: 'o', ρ: 'p', τ: 't',
  υ: 'u', χ: 'x', σ: 's', ς: 's', ω: 'w', η: 'n', μ: 'u',
  // Latin extended
  ø: 'o', ł: 'l', đ: 'd', ı: 'i', þ: 'p', ß: 'ss', æ: 'ae', œ: 'oe',
}

// Leet substitutions, applied after lowercasing (match-side only — the stored
// message keeps the user's original text).
const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b',
  '@': 'a', '$': 's', '!': 'i',
}

const mapChars = (s: string, map: Record<string, string>) =>
  Array.from(s, (c) => map[c] ?? c).join('')

/** Collapse runs of 3+ identical characters to one: "fuuuck" → "fuck". */
const collapseRuns = (s: string) => s.replace(/(.)\1{2,}/g, '$1')

/** Base canonicalization shared by every form. */
export function normalizeText(text: string): string {
  let t = text.normalize('NFKD').replace(/\p{M}/gu, '').replace(ZERO_WIDTH, '')
  t = mapChars(t, HOMOGLYPHS).toLowerCase()
  t = mapChars(t, HOMOGLYPHS) // second pass: NFKD can surface new lookalikes post-lowercase
  t = mapChars(t, LEET)
  return t
}

export function normalizeForms(text: string): NormalForms {
  const t = normalizeText(text)
  const spaced = collapseRuns(t.replace(/[^a-z0-9]+/g, ' ')).replace(/\s+/g, ' ').trim()
  const squashed = collapseRuns(t.replace(/[^a-z0-9]/g, ''))
  const squashedDedup = squashed.replace(/(.)\1+/g, '$1')
  return { spaced, squashed, squashedDedup }
}

/**
 * Remove allowlisted words before matching, so "scunthorpe" can never trip a
 * pattern buried inside it. `allowSet` entries must be pre-normalized
 * (config.ts normalizes them when it builds the set).
 */
export function applyAllowlist(forms: NormalForms, allowSet: Set<string>): NormalForms {
  if (allowSet.size === 0) return forms
  const kept = forms.spaced.split(' ').filter((w) => w && !allowSet.has(w))
  const spaced = kept.join(' ')
  const squashed = spaced.replace(/ /g, '')
  return { spaced, squashed, squashedDedup: squashed.replace(/(.)\1+/g, '$1') }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Compile each admin-authored regex pattern once per process instead of per
// message (bounded by blocklist size; invalid patterns cache as null).
const regexCache = new Map<string, RegExp | null>()
function compilePattern(pattern: string): RegExp | null {
  const cached = regexCache.get(pattern)
  if (cached !== undefined) return cached
  let re: RegExp | null = null
  try {
    re = new RegExp(pattern, 'iu')
  } catch {
    re = null
  }
  regexCache.set(pattern, re)
  return re
}

/**
 * Match the blocklist against a message. Returns the first hit ('block' hits
 * win over 'flag' hits), or null when clean.
 *
 * Matching tiers per plain pattern:
 *  - multi-word patterns: phrase match on the spaced form
 *  - single words: word-boundary match on the spaced form, plus substring
 *    match on the squashed forms (catches "f.u.c.k") — substring matching is
 *    only used for patterns of 4+ chars so short patterns like "ass" can't
 *    fire inside innocent words ("passed").
 */
export function matchBlocklist(
  raw: string,
  forms: NormalForms,
  patterns: BlockPattern[],
  allowSet: Set<string>
): BlockPattern | null {
  if (patterns.length === 0) return null
  const f = applyAllowlist(forms, allowSet)
  const ordered = [...patterns].sort(
    (a, b) => (a.mode === 'block' ? 0 : 1) - (b.mode === 'block' ? 0 : 1)
  )

  for (const p of ordered) {
    if (p.is_regex) {
      // A bad regex added from the dashboard must never 500 the send route —
      // it compiles to null once and is skipped thereafter.
      const re = compilePattern(p.pattern)
      if (re && (re.test(raw) || re.test(f.spaced))) return p
      continue
    }

    const pf = normalizeForms(p.pattern)
    if (!pf.squashed) continue

    if (pf.spaced.includes(' ')) {
      if (f.spaced.includes(pf.spaced)) return p
      continue
    }

    const wordRe = new RegExp(`\\b${escapeRe(pf.spaced)}\\b`)
    if (wordRe.test(f.spaced)) return p
    if (pf.squashed.length >= 4) {
      if (f.squashed.includes(pf.squashed)) return p
      if (f.squashedDedup.includes(pf.squashedDedup)) return p
    }
  }
  return null
}

// ── Link detection ──────────────────────────────────────────────────────────
// Policy: no links in chat, at all. Runs on the RAW text (normalization would
// destroy the dots we are looking for).

const TLDS =
  'com|net|org|io|xyz|app|dev|fi|gg|me|co|ai|cc|tv|to|info|site|online|top|pro|lol|' +
  'finance|exchange|link|eth|fun|club|cash|money|vip|bet|casino|live|world|space|' +
  'tech|trade|market|capital|fund|plus|run|page|click|so|sh|wtf|one|life|today|' +
  'network|zone|digital|store|win|stream|us|uk|de|ru|cn|in|au|ca|tk|ml|ga|cf|gq'

// Protocol or www prefix.
const RE_PROTO = /(https?:\/\/|www\.)/i
// Plain domain — NO whitespace around the dot, so "done. today" can't match
// but "minebean.com" and "scam .com"-without-space always does.
const RE_PLAIN = new RegExp(`[a-z0-9][a-z0-9-]*\\.(?:${TLDS})(?![a-z0-9])`, 'i')
// Spelled out: "minebean dot com".
const RE_DOTWORD = new RegExp(`\\b[a-z0-9-]{2,}\\s+dot\\s+(?:${TLDS})\\b`, 'i')
// Defanged: "minebean[.]com", "minebean(.)com", "minebean {.} com".
const RE_DEFANGED = new RegExp(
  `[a-z0-9]\\s*[\\[({<]\\s*(?:\\.|dot)\\s*[\\])}>]\\s*(?:${TLDS})(?![a-z0-9])`,
  'i'
)
// Unicode dot lookalikes: "minebean。com".
const RE_UNIDOT = new RegExp(`[a-z0-9][。．｡·•]\\s*(?:${TLDS})(?![a-z0-9])`, 'i')

export function detectLink(raw: string): boolean {
  const t = raw.normalize('NFKC').replace(ZERO_WIDTH, '')
  return (
    RE_PROTO.test(t) ||
    RE_PLAIN.test(t) ||
    RE_DOTWORD.test(t) ||
    RE_DEFANGED.test(t) ||
    RE_UNIDOT.test(t)
  )
}
