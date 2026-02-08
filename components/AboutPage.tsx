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
            { id: "bean-rewards", label: "BEAN Rewards" },
            { id: "refining", label: "Refining" },
            { id: "autominer", label: "AutoMiner" },
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
                    <p style={{ margin: 0 }}><strong>BEANS</strong> is a gamified mining protocol on BNB Chain. Players compete in continuous 60-second rounds on a 5×5 grid of 25 blocks, deploying BNB to earn both BNB rewards and BEANS tokens.</p>
                    <p style={{ margin: 0 }}>Each round, players choose which blocks to deploy their BNB on. When the round ends, one winning block is randomly selected on-chain. All BNB deployed to losing blocks is redistributed to winners, proportional to their share of the winning block. The protocol takes a 10% vault fee from total deployed BNB, which funds buybacks, burns, and staker rewards.</p>
                    <p style={{ margin: 0 }}>Beyond BNB rewards, every round mints approximately 1 BEANS token awarded to a miner on the winning block, while a growing jackpot called the Beanpot adds an extra layer of excitement. A unique refining mechanic rewards patient miners who delay claiming their earned BEANS.</p>
                    <div style={isMobile ? styles.infoBoxMobile : styles.infoBox}>
                        <strong>Why BEANS?</strong>
                        <p style={{ margin: "12px 0 0 0" }}>Just like coffee beans need to be refined and roasted to reach their full potential, BEANS tokens reward patience. When you win BEANS, they start as &quot;unrefined&quot; — raw and unclaimed. A 10% refining fee is applied when you claim, and that fee is redistributed to other miners still holding unclaimed BEANS. The longer you let your BEANS roast, the more refined BEANS you accumulate from others claiming before you.</p>
                    </div>
                </div>
            ),
        },
        mining: {
            title: "Mining",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}>Mining is the core mechanic of BEANS. Rounds run continuously — each lasting 60 seconds — on a 5×5 grid of 25 blocks. You get one deploy per round.</p>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>How a Round Works</h3>
                        <ol style={{ ...styles.list, gap: listGap }}>
                            <li><strong>Select blocks</strong> — Choose which of the 25 blocks you want to deploy on. You can select anywhere from 1 to all 25.</li>
                            <li><strong>Set your amount</strong> — Enter how much BNB to deploy per block. The total cost is your per-block amount multiplied by the number of blocks you selected. There is a minimum of 0.00001 BNB per block.</li>
                            <li><strong>Deploy</strong> — Submit your transaction. You can only deploy once per round — once confirmed, your blocks are locked in and shown with a green border on the grid.</li>
                            <li><strong>Round ends</strong> — When the 60-second timer expires, blocks are eliminated one by one in a rapid animation until only the winning block remains.</li>
                            <li><strong>Rewards distributed</strong> — Winners on the winning block receive BNB proportional to their share of that block. The protocol takes a 10% vault fee from total deployed BNB, and the rest goes to winners.</li>
                        </ol>
                    </div>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Winner Selection</h3>
                        <p style={{ margin: 0 }}>The winning block is selected using a secure on-chain random number. This ensures fair and verifiable outcomes every round. All settlement data — winning block, rewards, and miner payouts — is recorded on-chain and visible in the Global stats page.</p>
                    </div>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Strategy</h3>
                        <ul style={{ ...styles.list, gap: listGap }}>
                            <li><strong>Fewer blocks, higher risk/reward</strong> — Concentrating your BNB on 1–5 blocks gives you a lower chance of winning, but your share of the winning pot is larger relative to what you deployed.</li>
                            <li><strong>More blocks, lower risk/reward</strong> — Spreading across many blocks increases your odds of being on the winner, but your payout is smaller relative to total cost.</li>
                            <li><strong>All 25 blocks</strong> — Guarantees you&apos;re on the winning block every round. After the 10% vault fee, you&apos;ll receive back roughly 90% of the total pot, minus what other winners on the same block earn proportionally.</li>
                        </ul>
                    </div>
                </div>
            ),
        },
        beanpot: {
            title: "The Beanpot",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}>The <strong>Beanpot</strong> is a growing BEANS jackpot that can be won on any round. It adds a jackpot element to every round of mining, rewarding lucky winners with a potentially large bonus on top of their normal rewards.</p>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>How It Works</h3>
                        <ol style={{ ...styles.list, gap: listGap }}>
                            <li>Each round, <strong>0.2 BEANS</strong> is added to the Beanpot from the round&apos;s token emission.</li>
                            <li>Every round has a <strong>1-in-625 chance</strong> of triggering the Beanpot.</li>
                            <li>If triggered, the entire Beanpot is distributed among the round&apos;s winners, proportional to their deployment on the winning block.</li>
                            <li>If not triggered, the pool carries over and continues growing, making the next potential payout even larger.</li>
                        </ol>
                    </div>
                    <div style={isMobile ? styles.infoBoxMobile : styles.infoBox}>
                        <strong>Beanpot Math</strong>
                        <p style={{ margin: "12px 0 0 0" }}>At 0.2 BEANS per round and roughly 1,440 rounds per day (one every 60 seconds), the Beanpot grows by about 288 BEANS daily if not triggered. With 1-in-625 odds, it triggers on average once every ~10 hours, though the actual timing is random.</p>
                    </div>
                </div>
            ),
        },
        "bean-rewards": {
            title: "BEAN Rewards",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}>Every round, approximately <strong>1 BEANS token</strong> is minted and awarded to miners on the winning block. This is the primary way new BEANS enter circulation.</p>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>How the Winner is Chosen</h3>
                        <p style={{ margin: 0 }}>The BEANS reward recipient is determined on-chain using a weighted random selection. Miners who deployed more BNB to the winning block have a proportionally higher chance of receiving the full reward.</p>
                    </div>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Split Rounds</h3>
                        <p style={{ margin: 0 }}>Some rounds result in a <strong>split</strong> instead of a single winner. In split rounds, the BEANS reward is divided among all miners on the winning block proportional to their deployment, rather than going to one person. Split rounds are indicated with a &quot;Split&quot; badge in the mining history.</p>
                    </div>
                </div>
            ),
        },
        refining: {
            title: "Refining",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}><strong>Refining</strong> is a mechanism that rewards patient miners. When you win BEANS from mining, they accumulate as &quot;unrefined&quot; tokens until you choose to claim them.</p>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>How It Works</h3>
                        <ol style={{ ...styles.list, gap: listGap }}>
                            <li><strong>Win BEANS</strong> — Your rewards accumulate as unrefined BEANS in the contract. You can see your unrefined balance in the Rewards panel.</li>
                            <li><strong>Others claim</strong> — When other miners claim their BEANS, a 10% refining fee is deducted from their claim. This fee is redistributed proportionally to all miners still holding unclaimed BEANS.</li>
                            <li><strong>Your refined balance grows</strong> — The longer you hold, the more refined BEANS you accumulate from other players&apos; refining fees. Your refined balance is shown separately from your unrefined balance.</li>
                            <li><strong>Claim when ready</strong> — When you claim, you receive both your unrefined and refined BEANS, minus the 10% fee on your unrefined portion. The fee from your claim then flows to the remaining holders.</li>
                        </ol>
                    </div>
                    <div style={isMobile ? styles.infoBoxMobile : styles.infoBox}>
                        <strong>The Patience Game</strong>
                        <p style={{ margin: "12px 0 0 0" }}>Refining creates a strategic tension: claim early and pay the 10% fee, or hold longer and benefit from others claiming before you. There&apos;s no lock-up — you can claim anytime — but the incentive structure rewards patience.</p>
                    </div>
                </div>
            ),
        },
        autominer: {
            title: "AutoMiner",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}>The <strong>AutoMiner</strong> lets you deploy automatically across multiple rounds without needing to manually submit a transaction each time. Deposit BNB upfront, configure your strategy, and the AutoMiner handles the rest.</p>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>How It Works</h3>
                        <ol style={{ ...styles.list, gap: listGap }}>
                            <li><strong>Choose a strategy</strong> — Select between &quot;All Blocks&quot; (deploys to all 25 blocks every round) or &quot;Random&quot; (deploys to a set number of randomly selected blocks).</li>
                            <li><strong>Set rounds and amount</strong> — Choose how many rounds to run and your BNB per block. The total deposit is calculated automatically.</li>
                            <li><strong>Activate</strong> — A single transaction deposits your BNB and starts the AutoMiner. It will deploy on your behalf each round until the configured number of rounds is complete.</li>
                            <li><strong>Stop anytime</strong> — You can stop the AutoMiner at any point. Remaining unspent BNB is refunded to your wallet.</li>
                        </ol>
                    </div>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Executor Fee</h3>
                        <p style={{ margin: 0 }}>The AutoMiner charges a 1% executor fee on your deposit to cover the gas costs of executing deployments on your behalf. This is deducted from your deposit upfront — the per-block and per-round amounts shown in the interface already account for this fee.</p>
                    </div>
                    <div style={isMobile ? styles.infoBoxMobile : styles.infoBox}>
                        <strong>Grid Behaviour</strong>
                        <p style={{ margin: "12px 0 0 0" }}>While AutoMiner is active, the mining grid is locked — you can&apos;t manually select or deploy blocks. Your auto-deployed blocks are highlighted in green each round. You can track rounds executed, remaining balance, and strategy from the controls panel.</p>
                    </div>
                </div>
            ),
        },
        supply: {
            title: "Supply",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}>BEANS has a fixed maximum supply with zero initial allocation. Every token in circulation was minted through mining — there is no pre-mine, team allocation, or investor distribution.</p>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Token Details</h3>
                        <table style={styles.table}>
                            <tbody>
                                <tr><td style={isMobile ? styles.tableLabelMobile : styles.tableLabel}>Token Name</td><td style={isMobile ? styles.tableValueMobile : styles.tableValue}>BEANS</td></tr>
                                <tr><td style={isMobile ? styles.tableLabelMobile : styles.tableLabel}>Network</td><td style={isMobile ? styles.tableValueMobile : styles.tableValue}>BNB Chain (BSC)</td></tr>
                                <tr><td style={isMobile ? styles.tableLabelMobile : styles.tableLabel}>Max Supply</td><td style={isMobile ? styles.tableValueMobile : styles.tableValue}>3,000,000 BEANS</td></tr>
                                <tr><td style={isMobile ? styles.tableLabelMobile : styles.tableLabel}>Initial Supply</td><td style={isMobile ? styles.tableValueMobile : styles.tableValue}>0 (fair launch)</td></tr>
                                <tr><td style={isMobile ? styles.tableLabelMobile : styles.tableLabel}>Emission</td><td style={isMobile ? styles.tableValueMobile : styles.tableValue}>~1 BEANS per round</td></tr>
                                <tr><td style={isMobile ? styles.tableLabelMobile : styles.tableLabel}>Round Duration</td><td style={isMobile ? styles.tableValueMobile : styles.tableValue}>60 seconds</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Emission Breakdown</h3>
                        <p style={{ margin: 0 }}>Each round mints approximately 1 BEANS, distributed as follows:</p>
                        <table style={styles.table}>
                            <tbody>
                                <tr><td style={isMobile ? styles.tableLabelMobile : styles.tableLabel}>BEAN Reward (winner)</td><td style={isMobile ? styles.tableValueMobile : styles.tableValue}>~0.8 BEANS</td></tr>
                                <tr><td style={isMobile ? styles.tableLabelMobile : styles.tableLabel}>Beanpot contribution</td><td style={isMobile ? styles.tableValueMobile : styles.tableValue}>0.2 BEANS</td></tr>
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
                    <p style={{ margin: 0 }}>The protocol generates revenue by taking a <strong>10% vault fee</strong> from all BNB deployed in mining rounds. This revenue is managed by the Treasury contract and used to support the token&apos;s value through buybacks and burns.</p>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Revenue Flow</h3>
                        <ol style={{ ...styles.list, gap: listGap }}>
                            <li><strong>Collection</strong> — 10% of all BNB deployed each round is sent to the Treasury.</li>
                            <li><strong>Buyback</strong> — The Treasury periodically uses accumulated BNB to buy BEANS from the BEAN/BNB liquidity pool on-chain.</li>
                            <li><strong>Burn</strong> — 90% of purchased BEANS are permanently burned, reducing circulating supply.</li>
                            <li><strong>Staker Rewards</strong> — The remaining 10% of purchased BEANS are distributed to BEANS stakers as yield.</li>
                        </ol>
                    </div>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Revenue Allocation</h3>
                        <table style={styles.table}>
                            <tbody>
                                <tr><td style={isMobile ? styles.tableLabelMobile : styles.tableLabel}>Buyback &amp; Burn</td><td style={isMobile ? styles.tableValueMobile : styles.tableValue}>90% of buyback</td></tr>
                                <tr><td style={isMobile ? styles.tableLabelMobile : styles.tableLabel}>Staker Rewards</td><td style={isMobile ? styles.tableValueMobile : styles.tableValue}>10% of buyback</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div style={isMobile ? styles.infoBoxMobile : styles.infoBox}>
                        <strong>Transparency</strong>
                        <p style={{ margin: "12px 0 0 0" }}>All buyback transactions are recorded on-chain and visible in the Global page under the Revenue tab. You can see exactly how much BNB was spent, how much BEANS was burned, and how much yield was generated for stakers.</p>
                    </div>
                </div>
            ),
        },
        burn: {
            title: "Burn Mechanism",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}>BEANS is designed to be <strong>deflationary</strong>. While new tokens are minted through mining (~1 per round), the burn mechanism works to offset and eventually exceed emission.</p>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>How Burns Work</h3>
                        <ol style={{ ...styles.list, gap: listGap }}>
                            <li>The Treasury collects 10% of all deployed BNB as protocol revenue.</li>
                            <li>This BNB is used to buy BEANS from the on-chain liquidity pool.</li>
                            <li>90% of purchased BEANS are sent to the burn address — permanently removed from circulation.</li>
                        </ol>
                    </div>
                    <div style={isMobile ? styles.infoBoxMobile : styles.infoBox}>
                        <strong>Deflationary Dynamics</strong>
                        <p style={{ margin: "12px 0 0 0" }}>The more BNB deployed across rounds, the more revenue the protocol generates, and the more BEANS are burned. As mining activity increases, buy pressure and burn rate scale with it — creating a positive feedback loop for the token&apos;s scarcity. Current burn totals are visible on the Global stats page.</p>
                    </div>
                </div>
            ),
        },
        staking: {
            title: "Staking",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}>Stake your BEANS tokens to earn a share of protocol revenue. Stakers receive 10% of all BEANS purchased through Treasury buybacks as yield, distributed proportionally based on stake size.</p>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>How Staking Works</h3>
                        <ol style={{ ...styles.list, gap: listGap }}>
                            <li><strong>Deposit BEANS</strong> — Stake your BEANS tokens into the staking contract.</li>
                            <li><strong>Earn yield</strong> — Each time the Treasury executes a buyback, 10% of the purchased BEANS is distributed to stakers proportional to their stake.</li>
                            <li><strong>Claim rewards</strong> — Accumulated staking rewards can be claimed at any time.</li>
                            <li><strong>Withdraw</strong> — Unstake your BEANS whenever you want. There is no lock-up period.</li>
                        </ol>
                    </div>
                    <div style={isMobile ? styles.infoBoxMobile : styles.infoBox}>
                        <strong>Staking vs Refining</strong>
                        <p style={{ margin: "12px 0 0 0" }}>Staking and refining are separate reward streams. Refining rewards come from the 10% fee when miners claim their unrefined BEANS. Staking rewards come from the Treasury buyback cycle — funded by the 10% vault fee on deployed BNB. You can benefit from both by mining (to earn unrefined BEANS through refining) and staking (to earn yield from buybacks).</p>
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
                        <p style={{ margin: "12px 0 0 0" }}>BEANS is a gamified mining protocol on BNB Chain. Players deploy BNB on a 5×5 grid in 60-second rounds, competing to land on the randomly selected winning block and earn BNB rewards plus BEANS tokens.</p>
                    </div>
                    <div style={styles.faqItem}>
                        <h4 style={isMobile ? styles.h4Mobile : styles.h4}>Can I lose my BNB?</h4>
                        <p style={{ margin: "12px 0 0 0" }}>Yes. If none of your selected blocks are the winning block, your deployed BNB goes to the winners. You can reduce risk by deploying on more blocks, or eliminate it entirely by covering all 25 — though the 10% vault fee means you&apos;ll receive back less than you deployed.</p>
                    </div>
                    <div style={styles.faqItem}>
                        <h4 style={isMobile ? styles.h4Mobile : styles.h4}>How many times can I deploy per round?</h4>
                        <p style={{ margin: "12px 0 0 0" }}>Once. The smart contract enforces one deployment per round per wallet. After deploying, your blocks are locked in and you wait for the round to settle.</p>
                    </div>
                    <div style={styles.faqItem}>
                        <h4 style={isMobile ? styles.h4Mobile : styles.h4}>What is the minimum deployment?</h4>
                        <p style={{ margin: "12px 0 0 0" }}>0.00001 BNB per block. If you select 5 blocks, your minimum total would be 0.00005 BNB.</p>
                    </div>
                    <div style={styles.faqItem}>
                        <h4 style={isMobile ? styles.h4Mobile : styles.h4}>What is the Beanpot?</h4>
                        <p style={{ margin: "12px 0 0 0" }}>A growing BEANS jackpot funded by 0.2 BEANS per round. Each round has a 1-in-625 chance of triggering the Beanpot, distributing the entire pool to that round&apos;s winners.</p>
                    </div>
                    <div style={styles.faqItem}>
                        <h4 style={isMobile ? styles.h4Mobile : styles.h4}>What is refining?</h4>
                        <p style={{ margin: "12px 0 0 0" }}>When you claim earned BEANS, a 10% refining fee is deducted and redistributed to other miners still holding unclaimed BEANS. By delaying your claim, you accumulate &quot;refined&quot; BEANS from other players&apos; fees.</p>
                    </div>
                    <div style={styles.faqItem}>
                        <h4 style={isMobile ? styles.h4Mobile : styles.h4}>What does the AutoMiner do?</h4>
                        <p style={{ margin: "12px 0 0 0" }}>AutoMiner lets you deposit BNB upfront and automatically deploy across multiple rounds. Choose a strategy (all blocks or random), set how many rounds to run, and the protocol handles deployment each round. A 1% executor fee covers gas costs.</p>
                    </div>
                    <div style={styles.faqItem}>
                        <h4 style={isMobile ? styles.h4Mobile : styles.h4}>Where does protocol revenue come from?</h4>
                        <p style={{ margin: "12px 0 0 0" }}>10% of all BNB deployed in mining rounds is collected as a vault fee. This BNB is used by the Treasury to buy BEANS from the liquidity pool — 90% is burned and 10% goes to stakers.</p>
                    </div>
                    <div style={styles.faqItem}>
                        <h4 style={isMobile ? styles.h4Mobile : styles.h4}>Is there a token pre-mine or team allocation?</h4>
                        <p style={{ margin: "12px 0 0 0" }}>No. BEANS launched with zero initial supply. Every token in circulation was minted through mining rounds. The max supply is 3,000,000 BEANS.</p>
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
