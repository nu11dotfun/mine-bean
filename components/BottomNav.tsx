'use client'

import React from "react"
import Link from "next/link"

interface BottomNavProps {
    currentPage: string
}

export default function BottomNav({ currentPage }: BottomNavProps) {
    const navItems = [
        { 
            id: 'mine', 
            label: 'Mine', 
            href: '/',
            icon: (active: boolean) => (
                <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "#F0B90B" : "#666"}>
                    <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66l.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z" />
                </svg>
            )
        },
        { 
            id: 'about', 
            label: 'About', 
            href: '/about',
            icon: (active: boolean) => (
                <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "#F0B90B" : "#666"}>
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                </svg>
            )
        },
        { 
            id: 'global', 
            label: 'Global', 
            href: '/global',
            icon: (active: boolean) => (
                <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "#F0B90B" : "#666"}>
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                </svg>
            )
        },
        { 
            id: 'stake', 
            label: 'Stake', 
            href: '/stake',
            icon: (active: boolean) => (
                <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "#F0B90B" : "#666"}>
                    <path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.18l6 3.75v7.14l-6 3.75-6-3.75V7.93l6-3.75z" />
                    <path d="M12 6.5L8 9v6l4 2.5 4-2.5V9l-4-2.5z" />
                </svg>
            )
        },
    ]

    return (
        <nav style={styles.nav}>
            {navItems.map((item) => {
                const isActive = currentPage === item.id
                return (
                    <Link
                        key={item.id}
                        href={item.href}
                        style={{
                            ...styles.navItem,
                            ...(isActive ? styles.navItemActive : {}),
                        }}
                    >
                        {item.icon(isActive)}
                        <span style={styles.navLabel}>{item.label}</span>
                    </Link>
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
        background: '#0a0a0a',
        borderTop: '1px solid #222',
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
        color: '#F0B90B',
    },
    navLabel: {
        fontSize: '10px',
    },
}
