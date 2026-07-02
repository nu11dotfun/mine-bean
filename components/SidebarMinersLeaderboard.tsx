'use client'

import React, { useMemo, useState } from 'react'
import BeanLogo from './BeanLogo'

export interface SidebarMiner {
  address: string
  displayName?: string
  eth: number          // ETH figure shown (ETH won, for the settled-round view)
  beanWon?: number     // BEAN won this round; shown next to ETH when > 0
  blocks?: number[]    // deployed tiles; enables the tiles count + hover grid when present
}

const ETH_ICON = 'https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/f9461cf2-aacc-4c59-8b9d-59ade3c46c00/public'

function short(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr
}

export default function SidebarMinersLeaderboard({
  miners,
  pageSize = 5,
  title = 'Miners',
  subtitle,
  emptyText = 'No miners yet this round',
  ethUsd,
  winningBlock,
}: {
  miners: SidebarMiner[]
  pageSize?: number
  title?: string
  subtitle?: string
  emptyText?: string
  ethUsd?: number
  winningBlock?: number
}) {
  const [open, setOpen] = useState(true)
  const [page, setPage] = useState(0)
  const [hovered, setHovered] = useState<string | null>(null)
  const [hoveredEth, setHoveredEth] = useState<string | null>(null)

  const sorted = useMemo(
    () => [...miners].sort((a, b) => b.eth - a.eth),
    [miners],
  )
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const clampedPage = Math.min(page, pageCount - 1)
  const rows = sorted.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize)
  // Sole BEAN winner (whole bean, not a split) → shiny name.
  const beanWinnerCount = useMemo(() => miners.filter(m => (m.beanWon ?? 0) > 0).length, [miners])
  const sub = subtitle ?? `${miners.length} this round`

  return (
    <div style={styles.panel}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes smlWinnerShine { 0% { background-position: -100% 0; } 100% { background-position: 200% 0; } }
        .sml-winner {
          background-color: #4b93ff;
          background-image: linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.9) 50%, transparent 100%);
          background-repeat: no-repeat;
          background-size: 50% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 1px rgba(150,190,255,0.5)) drop-shadow(0 0 6px rgba(30,110,255,0.26)) drop-shadow(0 0 14px rgba(0,90,255,0.14));
          animation: smlWinnerShine 3.4s linear infinite;
          will-change: background-position;
        }
      ` }} />
      <div style={styles.header} onClick={() => setOpen(o => !o)}>
        <span style={styles.title}>{title}</span>
        <span style={styles.count}>{sub}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8892a6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'none' : 'rotate(180deg)', transition: 'transform 0.2s ease' }} aria-hidden="true">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </div>

      {open && (
        <>
          <div style={styles.list}>
            {sorted.length === 0 ? (
              <div style={styles.empty}>{emptyText}</div>
            ) : (
              rows.map((m) => (
                <div
                  key={m.address}
                  style={styles.row}
                  onMouseEnter={() => setHovered(m.address)}
                  onMouseLeave={() => setHovered(h => (h === m.address ? null : h))}
                >
                  <div style={styles.nameWrap}>
                    <span
                      className={beanWinnerCount === 1 && (m.beanWon ?? 0) > 0 ? 'sml-winner' : undefined}
                      style={beanWinnerCount === 1 && (m.beanWon ?? 0) > 0 ? { ...styles.name, color: 'transparent', overflow: 'visible', textOverflow: 'clip' } : styles.name}
                    >{m.displayName || short(m.address)}</span>
                    {m.beanWon != null && m.beanWon > 0 && (
                      <span style={styles.beanBadge}>
                        <BeanLogo size={13} />
                        {m.beanWon.toFixed(4)}
                      </span>
                    )}
                  </div>
                  {m.blocks && m.blocks.length > 0 && (
                    <span style={styles.tiles}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.55 }} aria-hidden="true">
                        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                      </svg>
                      {m.blocks.length}
                    </span>
                  )}
                  <span
                    style={styles.eth}
                    onMouseEnter={() => setHoveredEth(m.address)}
                    onMouseLeave={() => setHoveredEth(h => (h === m.address ? null : h))}
                  >
                    {hoveredEth === m.address && ethUsd != null && ethUsd > 0 ? (
                      `≈$${(m.eth * ethUsd).toFixed(2)}`
                    ) : (
                      <>
                        <img src={ETH_ICON} alt="ETH" width={13} height={13} style={{ marginRight: 3, opacity: 0.85 }} />
                        {m.eth.toFixed(4)}
                      </>
                    )}
                  </span>

                  {hovered === m.address && m.blocks && m.blocks.length > 0 && (
                    <div style={styles.popover}>
                      <div style={styles.grid}>
                        {Array.from({ length: 25 }, (_, b) => {
                          const on = m.blocks!.includes(b)
                          return (
                            <div key={b} style={{ ...styles.cell, ...(on ? styles.cellOn : styles.cellOff), ...(b === winningBlock ? styles.cellWin : {}) }}>{b + 1}</div>
                          )
                        })}
                      </div>
                      <div style={styles.popRow}>
                        <span style={styles.popLabel}>ETH WON</span>
                        <span style={styles.popVal}>
                          <img src={ETH_ICON} alt="ETH" width={13} height={13} style={{ marginRight: 3, opacity: 0.85 }} />
                          {m.eth.toFixed(4)}
                        </span>
                      </div>
                      <div style={styles.popRow}>
                        <span style={styles.popLabel}>BEAN WON</span>
                        {m.beanWon && m.beanWon > 0 ? (
                          <span style={{ ...styles.popVal, color: '#3D8BFF' }}>
                            <BeanLogo size={13} /> <span style={{ marginLeft: 3 }}>{m.beanWon.toFixed(4)}</span>
                          </span>
                        ) : (
                          <span style={styles.popDash}>—</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {pageCount > 1 && (
            <div style={styles.pager}>
              <button style={{ ...styles.pageBtn, opacity: clampedPage === 0 ? 0.35 : 1 }} onClick={() => setPage(p => Math.max(0, p - 1))} disabled={clampedPage === 0} aria-label="Previous page">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <button style={{ ...styles.pageBtn, opacity: clampedPage >= pageCount - 1 ? 0.35 : 1 }} onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={clampedPage >= pageCount - 1} aria-label="Next page">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  panel: { position: 'relative', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontFamily: "'Inter', -apple-system, sans-serif" },
  header: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', cursor: 'pointer', userSelect: 'none' },
  title: { fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Space Mono', ui-monospace, monospace", flex: 1 },
  count: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: "'Space Mono', ui-monospace, monospace" },
  list: { padding: '2px 0 6px', borderTop: '1px solid rgba(255,255,255,0.06)' },
  row: { position: 'relative', display: 'flex', alignItems: 'center', gap: 9, padding: '7px 14px' },
  nameWrap: { display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  name: { minWidth: 0, fontSize: 14, fontWeight: 500, color: '#F5F8FF', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  tiles: { display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: "'Space Mono', ui-monospace, monospace", flexShrink: 0 },
  eth: { display: 'flex', alignItems: 'center', fontSize: 12, color: '#E8EDF5', fontFamily: "'Space Mono', ui-monospace, monospace", justifyContent: 'flex-end', flexShrink: 0 },
  beanBadge: { display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: '#3D8BFF', fontFamily: "'Space Mono', ui-monospace, monospace", flexShrink: 0 },
  empty: { padding: '24px 14px', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  pager: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '8px 0 10px', borderTop: '1px solid rgba(255,255,255,0.06)' },
  pageBtn: { width: 26, height: 26, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },

  popover: { position: 'absolute', right: 'calc(100% + 12px)', top: '50%', transform: 'translateY(-50%)', width: 250, background: '#0B0F1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 14, zIndex: 60, boxShadow: '0 16px 44px rgba(0,0,0,0.55)', pointerEvents: 'none' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 12 },
  cell: { height: 34, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontFamily: "'Space Mono', ui-monospace, monospace" },
  cellOn: { border: '1px solid rgba(0,82,255,0.6)', background: 'rgba(0,82,255,0.12)', color: '#9DC2FF' },
  cellOff: { border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.2)' },
  cellWin: { border: '1px solid #F4B740', boxShadow: '0 0 6px rgba(244,183,64,0.35)', color: '#F4B740' },
  popRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' },
  popLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: "'Space Mono', ui-monospace, monospace", letterSpacing: '0.06em' },
  popVal: { display: 'flex', alignItems: 'center', fontSize: 12, color: '#E8EDF5', fontFamily: "'Space Mono', ui-monospace, monospace" },
  popDash: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },
}
