'use client'

import React from 'react'

export interface GlobalTab {
  id: string
  label: string
}

// Section nav: plain text labels separated by thin dividers, with the active
// one lifted into a rounded highlight (like a segmented-control button).
export default function GlobalTabs({
  tabs,
  active,
  onChange,
  isMobile,
}: {
  tabs: GlobalTab[]
  active: string
  onChange: (id: string) => void
  isMobile?: boolean
}) {
  return (
    <div style={styles.wrap} className="global-tabs-scroll">
      {tabs.map((t, i) => {
        const on = t.id === active
        return (
          <React.Fragment key={t.id}>
            {i > 0 && <span style={styles.divider} />}
            <button
              onClick={() => onChange(t.id)}
              style={{
                ...styles.tab,
                ...(on ? styles.tabOn : {}),
                fontSize: isMobile ? 13 : 14,
                padding: isMobile ? '7px 12px' : '8px 16px',
              }}
            >
              {t.label}
            </button>
          </React.Fragment>
        )
      })}
      <style dangerouslySetInnerHTML={{ __html: '.global-tabs-scroll::-webkit-scrollbar{display:none}' }} />
    </div>
  )
}

const styles: { [k: string]: React.CSSProperties } = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    overflowX: 'auto',
    scrollbarWidth: 'none',
    paddingBottom: 2,
  },
  divider: {
    width: 1,
    height: 15,
    background: 'rgba(255,255,255,0.12)',
    flexShrink: 0,
    margin: '0 6px',
  },
  tab: {
    flexShrink: 0,
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 10,
    color: '#8597b0',
    cursor: 'pointer',
    fontWeight: 500,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s',
  },
  tabOn: {
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#fff',
    fontWeight: 600,
  },
}
