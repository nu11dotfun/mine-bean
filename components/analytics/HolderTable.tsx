'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import BeanLogo from '@/components/BeanLogo'
import { apiFetch } from '@/lib/api'
import { useProfileResolver } from '@/lib/useProfileResolver'
import { useProtocolSummary } from '@/lib/protocolSummary'

// One full holder table for a single type, inside a bounded panel: sticky header,
// clear row dividers, and a bottom bar with wallet search + a live count. Every
// holder is loaded up front so search matches across all of them, not just what's
// scrolled into view. Dust wallets (effectively-zero balances) are filtered out.

type HolderType = 'stakers' | 'unroasted' | 'miners'

interface Cfg {
  endpoint: string
  arrKey: string
  valueKey: string
  unit: 'ETH' | 'BEAN'
  paginated: boolean
  showPct: boolean
  title: string
  description: string
  header: string
  minValue: number // hide dust below this so wallets never show as "0"
}

const CONFIG: Record<HolderType, Cfg> = {
  stakers: { endpoint: 'stakers', arrKey: 'stakers', valueKey: 'stakedBalanceFormatted', unit: 'BEAN', paginated: true, showPct: true, title: 'Stakers', description: 'Every wallet staking BEAN.', header: 'Staked', minValue: 0.01 },
  unroasted: { endpoint: 'earners', arrKey: 'earners', valueKey: 'unclaimedFormatted', unit: 'BEAN', paginated: true, showPct: false, title: 'Unroasted holders', description: 'Every wallet holding unroasted BEAN.', header: 'Unroasted', minValue: 0.01 },
  miners: { endpoint: 'miners', arrKey: 'deployers', valueKey: 'totalDeployedFormatted', unit: 'ETH', paginated: false, showPct: false, title: 'Miners', description: 'Miners by total ETH deployed.', header: 'Deployed', minValue: 0.0001 },
}

const PAGE = 50
const MINERS_LIMIT = 100
const MAX_PAGES = 40 // safety cap on the eager page loop

interface RawRow { address: string; value: number }
interface Row extends RawRow { rank: number }

async function fetchPage(cfg: Cfg, pageNum: number): Promise<{ rows: RawRow[]; endpointHasMore: boolean }> {
  const limit = cfg.paginated ? PAGE : MINERS_LIMIT
  const q = cfg.paginated ? `?page=${pageNum}&limit=${limit}` : `?period=all&limit=${limit}`
  const data = await apiFetch<Record<string, unknown>>(`/api/leaderboard/${cfg.endpoint}${q}`)
  const arr = (data[cfg.arrKey] as Record<string, unknown>[]) ?? []
  const rows: RawRow[] = arr.map((r) => ({ address: String(r.address), value: parseFloat(String(r[cfg.valueKey])) || 0 }))
  const pag = data.pagination as { pages?: number } | undefined
  const endpointHasMore = cfg.paginated && pag ? pageNum < (pag.pages ?? 1) : false
  return { rows, endpointHasMore }
}

const EthIcon = () => (
  <img src="https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/f9461cf2-aacc-4c59-8b9d-59ade3c46c00/public" alt="ETH" style={{ width: 16, height: 16, objectFit: 'contain' }} />
)

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7a8194" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const fmtAddr = (a: string) => (a && a.length >= 10 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a)
const fmtUsd = (v: number) => (v >= 1 ? '$' + Math.round(v).toLocaleString() : v > 0 ? '$' + v.toFixed(2) : '—')
const fmtPct = (p: number) => (p >= 0.01 ? p.toFixed(2) + '%' : '<0.01%')

export default function HolderTable({ type, isMobile }: { type: HolderType; isMobile: boolean }) {
  const cfg = CONFIG[type]
  const { summary } = useProtocolSummary()
  const [allRows, setAllRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [hovered, setHovered] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // The resolver batches up to 50 addresses per fetch, so resolve the top rows by
  // rank (what people actually look at). Tail wallets fall back to truncated
  // addresses — they rarely have a profile set anyway.
  const { profiles, resolve } = useProfileResolver(useMemo(() => allRows.slice(0, 50).map((r) => r.address), [allRows]))

  useEffect(() => { setMounted(true) }, [])

  // Load every holder up front (page by page, stopping at the dust tail) so the
  // search box can match across all of them, not just what's scrolled into view.
  const loadAll = useCallback(async () => {
    setLoading(true)
    const acc: RawRow[] = []
    try {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const { rows: raw, endpointHasMore } = await fetchPage(cfg, page)
        acc.push(...raw.filter((r) => r.value >= cfg.minValue))
        const hitDust = raw.length > 0 && raw[raw.length - 1].value < cfg.minValue
        if (!endpointHasMore || hitDust || raw.length === 0) break
      }
    } catch {
      /* keep whatever loaded */
    }
    setAllRows(acc.map((r, i) => ({ ...r, rank: i + 1 })))
    setLoading(false)
  }, [cfg])

  useEffect(() => {
    if (!mounted) return
    loadAll()
  }, [mounted, loadAll])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allRows
    return allRows.filter((r) => {
      if (r.address.toLowerCase().includes(q)) return true
      const info = profiles.get(r.address.toLowerCase())
      return info?.username ? info.username.toLowerCase().includes(q) : false
    })
  }, [allRows, search, profiles])

  if (!mounted) return null

  const price = cfg.unit === 'ETH' ? (summary?.ethUsd ?? 0) : (summary?.beanUsd ?? 0)
  const totalSupply = summary?.totalSupply ?? 0
  const colSpan = cfg.showPct ? 5 : 4

  return (
    <div>
      <h2 style={isMobile ? styles.titleMobile : styles.title}>{cfg.title}</h2>
      <p style={isMobile ? styles.descriptionMobile : styles.description}>{cfg.description}</p>

      {loading && allRows.length === 0 ? (
        <div style={styles.emptyState}><p style={styles.emptyText}>Loading...</p></div>
      ) : allRows.length === 0 ? (
        <div style={styles.emptyState}><p style={styles.emptyText}>No data available</p></div>
      ) : (
        <div style={styles.panel}>
          <div ref={scrollRef} style={{ ...styles.scrollBody, maxHeight: isMobile ? 440 : 560 }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Rank</th>
                  <th style={styles.th}>Address</th>
                  <th style={styles.thRight}>{cfg.header}</th>
                  <th style={styles.thRight}>USD Value</th>
                  {cfg.showPct && <th style={styles.thRight}>% of Supply</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const info = profiles.get(row.address.toLowerCase())
                  const usd = row.value * price
                  const pct = cfg.showPct && totalSupply > 0 ? (row.value / totalSupply) * 100 : null
                  return (
                    <tr
                      key={row.address}
                      style={{ ...styles.tr, background: hovered === row.rank ? 'rgba(255,255,255,0.05)' : 'transparent' }}
                      onMouseEnter={() => setHovered(row.rank)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => window.open(`https://basescan.org/address/${row.address}`, '_blank')}
                    >
                      <td style={styles.td}>#{row.rank}</td>
                      <td style={styles.td}>
                        <span style={styles.addressCell}>
                          {info?.pfpUrl ? <img src={info.pfpUrl} alt="" style={styles.addressPfp} /> : null}
                          <span>{resolve(row.address) || fmtAddr(row.address)}</span>
                        </span>
                      </td>
                      <td style={styles.tdRight}>
                        <span style={styles.valueWithIcon}>
                          {cfg.unit === 'ETH' ? <EthIcon /> : <BeanLogo size={16} />}
                          {row.value.toLocaleString(undefined, { maximumFractionDigits: cfg.unit === 'ETH' ? 4 : 2 })}
                        </span>
                      </td>
                      <td style={styles.tdRight}>{price > 0 ? fmtUsd(usd) : '—'}</td>
                      {cfg.showPct && <td style={styles.tdRight}>{pct != null ? fmtPct(pct) : '—'}</td>}
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={colSpan} style={styles.noMatch}>No matching wallet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={styles.footerBar}>
            <div style={{ ...styles.searchWrap, maxWidth: isMobile ? 'none' : 340 }}>
              <SearchIcon />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search wallet or name"
                spellCheck={false}
                style={styles.searchInput}
              />
              {search && (
                <button onClick={() => setSearch('')} style={styles.clearBtn} aria-label="Clear search">×</button>
              )}
            </div>
            <span style={styles.count}>
              {filtered.length.toLocaleString()} of {allRows.length.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  title: { fontSize: '20px', fontWeight: 600, color: '#fff', margin: 0, marginBottom: '6px' },
  titleMobile: { fontSize: '17px', fontWeight: 600, color: '#fff', margin: 0, marginBottom: '4px' },
  description: { fontSize: '14px', color: '#999', margin: 0, marginBottom: '16px' },
  descriptionMobile: { fontSize: '12px', color: '#999', margin: 0, marginBottom: '12px' },
  panel: { background: 'rgba(11,14,22,0.55)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, boxShadow: '0 0 44px rgba(0,82,255,0.05)', overflow: 'hidden' },
  scrollBody: { overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '520px' },
  th: { textAlign: 'left', padding: '12px 16px', fontSize: '13px', fontWeight: 500, color: '#999', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'rgba(11,14,22,0.98)', boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.12)', zIndex: 1 },
  thRight: { textAlign: 'right', padding: '12px 16px', fontSize: '13px', fontWeight: 500, color: '#999', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'rgba(11,14,22,0.98)', boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.12)', zIndex: 1 },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', transition: 'background 0.15s' },
  td: { padding: '13px 16px', fontSize: '14px', color: '#fff', whiteSpace: 'nowrap' },
  tdRight: { padding: '13px 16px', fontSize: '14px', color: '#fff', textAlign: 'right', whiteSpace: 'nowrap' },
  valueWithIcon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' },
  addressCell: { display: 'inline-flex', alignItems: 'center', gap: '8px' },
  addressPfp: { width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 },
  noMatch: { padding: '32px 16px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.5)' },
  footerBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.1)', background: 'transparent' },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 auto', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '7px 11px' },
  searchInput: { flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontSize: '13px', color: '#fff', padding: 0 },
  clearBtn: { flexShrink: 0, background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '18px', lineHeight: 1, cursor: 'pointer', padding: 0 },
  count: { fontSize: '12px', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', flexShrink: 0 },
  emptyState: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '8px' },
  emptyText: { fontSize: '14px', color: '#999', margin: 0 },
}
