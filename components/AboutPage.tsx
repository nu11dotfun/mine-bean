'use client'

import React, { useState } from "react"

interface AboutPageProps {
    initialSection?: string
    isMobile?: boolean
}

export default function AboutPage({
    initialSection = "overview",
    isMobile = false,
}: AboutPageProps) {
    const [activeSection, setActiveSection] = useState(initialSection)
    const [expandedItems, setExpandedItems] = useState<string[]>(["how-it-works", "tokenomics"])

    const toggleExpanded = (id: string) => {
        setExpandedItems((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id])
    }

    const navigation = [
        { id: "overview", label: "Overview" },
        { id: "how-it-works", label: "How It Works", children: [
            { id: "mining", label: "Mining" },
            { id: "beanpot", label: "The Beanpot" },
            { id: "golden-bean", label: "Golden Bean" },
            { id: "refining", label: "Refining" },
        ]},
        { id: "tokenomics", label: "Tokenomics", children: [
            { id: "supply", label: "Supply" },
            { id: "protocol-revenue", label: "Protocol Revenue" },
            { id: "burn", label: "Burn Mechanism" },
        ]},
        { id: "staking", label: "Staking" },
        { id: "faq", label: "FAQ" },
    ]

    const sectionGap = isMobile ? "28px" : "40px"
    const paragraphGap = isMobile ? "16px" : "20px"
    const listGap = isMobile ? "12px" : "16px"

    const content: Record<string, { title: string; content: React.ReactNode }> = {
        overview: {
            title: "Overview",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: paragraphGap }}>
                    <p style={{ margin: 0 }}><strong>BEANS</strong> is a gamified mining protocol on BNB Chain where players compete in 60-second rounds to earn rewards.</p>
                    <p style={{ margin: 0 }}>Deploy BNB on a 5×5 grid of 25 blocks. At the end of each round, one winning block is randomly selected. Players on the winning block share the BNB from all losing blocks, proportional to their deployment.</p>
                    <p style={{ margin: 0 }}>Each round also emits BEANS tokens to winners, with bonus jackpots and rewards for patient miners who delay claiming.</p>
                    <div style={isMobile ? styles.infoBoxMobile : styles.infoBox}>
                        <strong>Why BEANS?</strong>
                        <p style={{ margin: "12px 0 0 0" }}>Just like coffee beans need to be refined and roasted to reach their full potential, BEANS tokens reward patience. The longer you let your mined BEANS roast (remain unclaimed), the more you earn from the refining mechanism.</p>
                    </div>
                </div>
            ),
        },
        mining: {
            title: "Mining",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}>Mining is the core mechanic of BEANS. Each round lasts 60 seconds and takes place on a 5×5 grid of 25 blocks.</p>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>How It Works</h3>
                        <ol style={{ ...styles.list, gap: listGap }}>
                            <li><strong>Deploy BNB</strong> – Choose which block(s) to deploy your BNB on.</li>
                            <li><strong>Wait for the round to end</strong> – Each round lasts 60 seconds.</li>
                            <li><strong>Winning block selected</strong> – A secure random number generator selects one winning block.</li>
                            <li><strong>Rewards distributed</strong> – BNB from losing blocks goes to winners proportionally.</li>
                        </ol>
                    </div>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Strategy</h3>
                        <ul style={{ ...styles.list, gap: listGap }}>
                            <li><strong>Spread your BNB</strong> across multiple blocks for higher win chance but smaller payouts</li>
                            <li><strong>Concentrate on fewer blocks</strong> for lower chance but larger payouts</li>
                            <li><strong>Cover all 25 blocks</strong> to guarantee winning (minus protocol fees)</li>
                        </ul>
                    </div>
                </div>
            ),
        },
        beanpot: {
            title: "The Beanpot",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}>The <strong>Beanpot</strong> is a growing jackpot pool that adds excitement to every round.</p>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>How It Works</h3>
                        <ol style={{ ...styles.list, gap: listGap }}>
                            <li>Each round, <strong>0.2 BEANS</strong> is added to the Beanpot.</li>
                            <li>There is a <strong>1-in-625 chance</strong> the Beanpot is hit each round.</li>
                            <li>If hit, the pool is split among winners proportionally.</li>
                            <li>If not hit, it keeps growing.</li>
                        </ol>
                    </div>
                </div>
            ),
        },
        "golden-bean": {
            title: "Golden Bean",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}>The <strong>Golden Bean</strong> is a +1 BEANS bonus awarded to one miner on the winning block each round.</p>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>How It Works</h3>
                        <ol style={{ ...styles.list, gap: listGap }}>
                            <li>Each round, one miner receives <strong>+1 BEANS</strong> bonus.</li>
                            <li>Winner selected randomly, weighted by deployment amount.</li>
                            <li>Sometimes split among all winners instead.</li>
                        </ol>
                    </div>
                </div>
            ),
        },
        refining: {
            title: "Refining",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}><strong>Refining</strong> rewards patient miners who delay claiming.</p>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>How It Works</h3>
                        <ol style={{ ...styles.list, gap: listGap }}>
                            <li>Won BEANS are <strong>unrefined</strong> until claimed.</li>
                            <li>Claiming applies a <strong>10% refining fee</strong>.</li>
                            <li>This fee redistributes to miners with unclaimed BEANS.</li>
                            <li>Longer holds = more bonus BEANS.</li>
                        </ol>
                    </div>
                </div>
            ),
        },
        supply: {
            title: "Supply",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Token Details</h3>
                        <table style={styles.table}>
                            <tbody>
                                <tr><td style={isMobile ? styles.tableLabelMobile : styles.tableLabel}>Token Name</td><td style={isMobile ? styles.tableValueMobile : styles.tableValue}>BEANS</td></tr>
                                <tr><td style={isMobile ? styles.tableLabelMobile : styles.tableLabel}>Network</td><td style={isMobile ? styles.tableValueMobile : styles.tableValue}>BNB Chain (BSC)</td></tr>
                                <tr><td style={isMobile ? styles.tableLabelMobile : styles.tableLabel}>Max Supply</td><td style={isMobile ? styles.tableValueMobile : styles.tableValue}>3,000,000 BEANS</td></tr>
                                <tr><td style={isMobile ? styles.tableLabelMobile : styles.tableLabel}>Initial Supply</td><td style={isMobile ? styles.tableValueMobile : styles.tableValue}>0</td></tr>
                                <tr><td style={isMobile ? styles.tableLabelMobile : styles.tableLabel}>Emission Rate</td><td style={isMobile ? styles.tableValueMobile : styles.tableValue}>~1 BEANS per round</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            ),
        },
        "protocol-revenue": {
            title: "Protocol Revenue",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}>BEANS generates protocol revenue from mining activity.</p>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Revenue Usage</h3>
                        <table style={styles.table}>
                            <tbody>
                                <tr><td style={isMobile ? styles.tableLabelMobile : styles.tableLabel}>Buyback & Burn</td><td style={isMobile ? styles.tableValueMobile : styles.tableValue}>90% of revenue</td></tr>
                                <tr><td style={isMobile ? styles.tableLabelMobile : styles.tableLabel}>Staker Rewards</td><td style={isMobile ? styles.tableValueMobile : styles.tableValue}>10% of revenue</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            ),
        },
        burn: {
            title: "Burn Mechanism",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}>BEANS is designed to be <strong>deflationary</strong>.</p>
                    <p style={{ margin: 0 }}>90% of all BEANS bought with protocol revenue are permanently burned.</p>
                </div>
            ),
        },
        staking: {
            title: "Staking",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}>Stake your BEANS to earn a share of protocol revenue.</p>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>How Staking Works</h3>
                        <ol style={{ ...styles.list, gap: listGap }}>
                            <li><strong>Deposit BEANS</strong> into the staking contract</li>
                            <li><strong>Earn rewards</strong> from protocol revenue</li>
                            <li><strong>Withdraw anytime</strong> – no lock-up period</li>
                        </ol>
                    </div>
                </div>
            ),
        },
        faq: {
            title: "FAQ",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <div style={styles.faqItem}>
                        <h4 style={isMobile ? styles.h4Mobile : styles.h4}>What is BEANS?</h4>
                        <p style={{ margin: "12px 0 0 0" }}>A gamified mining protocol on BNB Chain with 60-second rounds.</p>
                    </div>
                    <div style={styles.faqItem}>
                        <h4 style={isMobile ? styles.h4Mobile : styles.h4}>Can I lose my BNB?</h4>
                        <p style={{ margin: "12px 0 0 0" }}>Yes, if your block doesn't win. Cover all 25 blocks to guarantee wins.</p>
                    </div>
                    <div style={styles.faqItem}>
                        <h4 style={isMobile ? styles.h4Mobile : styles.h4}>What is refining?</h4>
                        <p style={{ margin: "12px 0 0 0" }}>A 10% fee on claims redistributed to patient miners.</p>
                    </div>
                </div>
            ),
        },
    }

    if (isMobile) {
        return (
            <div style={styles.mobileContainer}>
                <aside style={styles.mobileSidebar}>
                    <div style={styles.mobileSidebarHeader}>
                        <span style={styles.mobileSidebarTitle}>Docs</span>
                    </div>
                    <nav style={styles.mobileSidebarNav}>
                        {navigation.map((item) => (
                            <div key={item.id}>
                                {item.children ? (
                                    <>
                                        <button style={{ ...styles.mobileNavParent, ...(expandedItems.includes(item.id) ? styles.mobileNavParentExpanded : {}) }} onClick={() => toggleExpanded(item.id)}>
                                            <span>{item.label}</span>
                                            <span style={{ ...styles.chevron, transform: expandedItems.includes(item.id) ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
                                        </button>
                                        {expandedItems.includes(item.id) && (
                                            <div style={styles.mobileNavChildren}>
                                                {item.children.map((child) => (
                                                    <button key={child.id} style={{ ...styles.mobileNavChild, ...(activeSection === child.id ? styles.mobileNavChildActive : {}) }} onClick={() => setActiveSection(child.id)}>{child.label}</button>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <button style={{ ...styles.mobileNavItem, ...(activeSection === item.id ? styles.mobileNavItemActive : {}) }} onClick={() => setActiveSection(item.id)}>{item.label}</button>
                                )}
                            </div>
                        ))}
                    </nav>
                </aside>
                <main style={styles.mobileMain}>
                    <article style={styles.mobileArticle}>
                        <h1 style={styles.mobileTitle}>{content[activeSection]?.title || "Overview"}</h1>
                        <div style={styles.mobileContent}>{content[activeSection]?.content || content.overview.content}</div>
                    </article>
                </main>
            </div>
        )
    }

    return (
        <div style={styles.container}>
            <aside style={styles.sidebar}>
                <div style={styles.sidebarHeader}>
                    <span style={styles.sidebarTitle}>BEANS Docs</span>
                </div>
                <nav style={styles.sidebarNav}>
                    {navigation.map((item) => (
                        <div key={item.id}>
                            {item.children ? (
                                <>
                                    <button style={{ ...styles.navParent, ...(expandedItems.includes(item.id) ? styles.navParentExpanded : {}) }} onClick={() => toggleExpanded(item.id)}>
                                        <span>{item.label}</span>
                                        <span style={{ ...styles.chevron, transform: expandedItems.includes(item.id) ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
                                    </button>
                                    {expandedItems.includes(item.id) && (
                                        <div style={styles.navChildren}>
                                            {item.children.map((child) => (
                                                <button key={child.id} style={{ ...styles.navChild, ...(activeSection === child.id ? styles.navChildActive : {}) }} onClick={() => setActiveSection(child.id)}>{child.label}</button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <button style={{ ...styles.navItem, ...(activeSection === item.id ? styles.navItemActive : {}) }} onClick={() => setActiveSection(item.id)}>{item.label}</button>
                            )}
                        </div>
                    ))}
                </nav>
            </aside>
            <main style={styles.main}>
                <article style={styles.article}>
                    <h1 style={styles.title}>{content[activeSection]?.title || "Overview"}</h1>
                    <div style={styles.content}>{content[activeSection]?.content || content.overview.content}</div>
                </article>
            </main>
        </div>
    )
}

const styles: { [key: string]: React.CSSProperties } = {
    container: { display: "flex", minHeight: "100vh", background: "#0a0a0a", fontFamily: "'Inter', -apple-system, sans-serif" },
    sidebar: { width: "280px", borderRight: "1px solid #1a1a1a", padding: "24px 0", position: "sticky", top: 0, height: "100vh", overflowY: "auto" },
    sidebarHeader: { display: "flex", alignItems: "center", gap: "10px", padding: "0 24px 24px", borderBottom: "1px solid #1a1a1a", marginBottom: "16px" },
    sidebarTitle: { fontSize: "18px", fontWeight: 700, color: "#fff" },
    sidebarNav: { padding: "0 12px" },
    navItem: { display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "10px 12px", background: "transparent", border: "none", borderRadius: "6px", color: "#888", fontSize: "14px", fontWeight: 500, cursor: "pointer", textAlign: "left", fontFamily: "inherit" },
    navItemActive: { background: "#1a1a1a", color: "#fff" },
    navParent: { display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px 12px", background: "transparent", border: "none", borderRadius: "6px", color: "#888", fontSize: "14px", fontWeight: 500, cursor: "pointer", textAlign: "left", fontFamily: "inherit" },
    navParentExpanded: { color: "#fff" },
    chevron: { fontSize: "16px", transition: "transform 0.15s" },
    navChildren: { paddingLeft: "20px", marginTop: "4px" },
    navChild: { display: "block", width: "100%", padding: "8px 12px", background: "transparent", border: "none", borderLeft: "2px solid #333", color: "#666", fontSize: "13px", fontWeight: 500, cursor: "pointer", textAlign: "left", fontFamily: "inherit" },
    navChildActive: { borderLeftColor: "#F0B90B", color: "#fff", background: "#1a1a1a" },
    main: { flex: 1, padding: "48px 48px 80px", maxWidth: "800px" },
    article: { color: "#fff" },
    title: { fontSize: "36px", fontWeight: 700, marginBottom: "40px", color: "#fff" },
    content: { fontSize: "16px", lineHeight: 1.8, color: "#ccc" },
    h3: { fontSize: "20px", fontWeight: 600, color: "#fff", margin: "0 0 16px 0" },
    h4: { fontSize: "18px", fontWeight: 600, color: "#fff", margin: 0 },
    list: { margin: 0, paddingLeft: "24px", display: "flex", flexDirection: "column" },
    infoBox: { background: "#1a1a1a", border: "1px solid #333", borderRadius: "12px", padding: "20px", marginTop: "8px" },
    table: { width: "100%", borderCollapse: "collapse", marginTop: "8px" },
    tableLabel: { padding: "14px 16px", borderBottom: "1px solid #222", color: "#888", fontWeight: 500, fontSize: "15px" },
    tableValue: { padding: "14px 16px", borderBottom: "1px solid #222", color: "#fff", textAlign: "right", fontSize: "15px" },
    faqItem: { borderBottom: "1px solid #222", paddingBottom: "32px" },
    mobileContainer: { display: "flex", minHeight: "100vh", background: "#0a0a0a", fontFamily: "'Inter', -apple-system, sans-serif" },
    mobileSidebar: { width: "120px", borderRight: "1px solid #1a1a1a", padding: "12px 0", flexShrink: 0 },
    mobileSidebarHeader: { padding: "0 10px 10px", borderBottom: "1px solid #1a1a1a", marginBottom: "8px" },
    mobileSidebarTitle: { fontSize: "13px", fontWeight: 700, color: "#fff" },
    mobileSidebarNav: { padding: "0 4px" },
    mobileNavItem: { display: "flex", alignItems: "center", width: "100%", padding: "8px 6px", background: "transparent", border: "none", borderRadius: "4px", color: "#888", fontSize: "12px", fontWeight: 500, cursor: "pointer", textAlign: "left", fontFamily: "inherit" },
    mobileNavItemActive: { background: "#1a1a1a", color: "#fff" },
    mobileNavParent: { display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "8px 6px", background: "transparent", border: "none", borderRadius: "4px", color: "#888", fontSize: "12px", fontWeight: 500, cursor: "pointer", textAlign: "left", fontFamily: "inherit" },
    mobileNavParentExpanded: { color: "#fff" },
    mobileNavChildren: { paddingLeft: "6px", marginTop: "2px" },
    mobileNavChild: { display: "block", width: "100%", padding: "6px 6px", background: "transparent", border: "none", borderLeft: "2px solid #333", color: "#666", fontSize: "11px", fontWeight: 500, cursor: "pointer", textAlign: "left", fontFamily: "inherit" },
    mobileNavChildActive: { borderLeftColor: "#F0B90B", color: "#fff", background: "#1a1a1a" },
    mobileMain: { flex: 1, padding: "16px 16px 80px", overflowX: "hidden" },
    mobileArticle: { color: "#fff" },
    mobileTitle: { fontSize: "22px", fontWeight: 700, marginBottom: "24px", color: "#fff" },
    mobileContent: { fontSize: "14px", lineHeight: 1.7, color: "#ccc" },
    h3Mobile: { fontSize: "16px", fontWeight: 600, color: "#fff", margin: "0 0 12px 0" },
    h4Mobile: { fontSize: "15px", fontWeight: 600, color: "#fff", margin: 0 },
    infoBoxMobile: { background: "#1a1a1a", border: "1px solid #333", borderRadius: "10px", padding: "14px", marginTop: "8px", fontSize: "13px" },
    tableLabelMobile: { padding: "10px 10px", borderBottom: "1px solid #222", color: "#888", fontWeight: 500, fontSize: "13px" },
    tableValueMobile: { padding: "10px 10px", borderBottom: "1px solid #222", color: "#fff", textAlign: "right", fontSize: "13px" },
}