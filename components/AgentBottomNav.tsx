'use client'

import React from "react"
import Link from "next/link"

interface AgentBottomNavProps {
    currentPage: string
}

export default function AgentBottomNav({ currentPage }: AgentBottomNavProps) {
    const navItems = [
        {
            id: 'agents',
            label: 'Agents',
            href: '/agents',
            icon: (active: boolean) => (
                <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "#0052FF" : "#666"}>
                    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.17A3.001 3.001 0 0 1 15 19H9a3.001 3.001 0 0 1-4.83 0H3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zm-3 12a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
                </svg>
            )
        },
        {
            id: 'beanbook',
            label: 'Beanbook',
            href: '/beanbook',
            icon: (active: boolean) => (
                <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "#0052FF" : "#666"}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
            )
        },
        {
            id: 'integrations',
            label: 'Integrations',
            href: '/integrations',
            icon: (active: boolean) => (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#0052FF" : "#666"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
            )
        },
        {
            id: 'minebean',
            label: 'MineBean',
            href: 'https://www.minebean.com',
            icon: (active: boolean) => (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#0052FF" : "#666"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
            )
        },
    ]

    return (
        <nav style={styles.nav}>
            {navItems.map((item) => {
                const isActive = currentPage === item.id
                const isExternal = item.href.startsWith('http')
                const Component = isExternal ? 'a' : Link
                const props = isExternal
                    ? { href: item.href }
                    : { href: item.href }

                return (
                    <Component
                        key={item.id}
                        {...props}
                        style={{
                            ...styles.navItem,
                            ...(isActive ? styles.navItemActive : {}),
                        }}
                    >
                        {item.icon(isActive)}
                        <span style={styles.navLabel}>{item.label}</span>
                    </Component>
                )
            })}
        </nav>
    )
}

const styles: { [key: string]: React.CSSProperties } = {
    nav: {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        background: 'rgba(8, 11, 20, 0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '10px 0 16px 0',
        fontFamily: "'Inter', -apple-system, sans-serif",
        zIndex: 1000,
    },
    navItem: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        color: '#666',
        fontSize: '10px',
        fontWeight: 600,
        textDecoration: 'none',
        padding: '4px 8px',
    },
    navItemActive: {
        color: '#999',
    },
    navLabel: {
        fontSize: '10px',
    },
}
