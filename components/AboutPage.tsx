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
            { id: "getting-started", label: "Getting Started" },
            { id: "mining", label: "Mining" },
            { id: "beanpot", label: "The Beanpot" },
            { id: "bean-rewards", label: "BEAN Rewards" },
            { id: "roasting", label: "Roasting" },
            { id: "autominer", label: "AutoMiner" },
            { id: "strategy", label: "Strategy" },
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

    const SectionImage = ({ alt, placeholder, maxWidth = "480px" }: { alt: string; placeholder: string; maxWidth?: string }) => (
        <div style={{ maxWidth, borderRadius: "12px", overflow: "hidden", border: "1px solid #222", marginTop: "8px", marginBottom: "8px" }}>
            <img src={`/images/about/${placeholder}`} alt={alt} style={{ width: "100%", height: "auto", display: "block" }} />
        </div>
    )

    const SideBySideImages = ({ left, right, maxWidth = "520px" }: { left: { alt: string; placeholder: string }; right: { alt: string; placeholder: string }; maxWidth?: string }) => (
        <div style={{ display: "flex", gap: "12px", marginTop: "8px", marginBottom: "8px", maxWidth }}>
            <div style={{ flex: 1, borderRadius: "12px", overflow: "hidden", border: "1px solid #222" }}>
                <img src={`/images/about/${left.placeholder}`} alt={left.alt} style={{ width: "100%", height: "auto", display: "block" }} />
            </div>
            <div style={{ flex: 1, borderRadius: "12px", overflow: "hidden", border: "1px solid #222" }}>
                <img src={`/images/about/${right.placeholder}`} alt={right.alt} style={{ width: "100%", height: "auto", display: "block" }} />
            </div>
        </div>
    )

    const content: Record<string, { title: string; content: React.ReactNode }> = {
        overview: {
            title: "Overview",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: paragraphGap }}>
                    <p style={{ margin: 0 }}><strong>BEANS</strong> is a gamified mining protocol on BNB Chain where players compete in continuous 60-second rounds to earn BNB and BEANS tokens. It combines the excitement of competitive gaming with real DeFi mechanics — every round has real stakes, real winners, and real rewards.</p>
                    <p style={{ margin: 0 }}>The game takes place on a 5×5 grid of 25 blocks. Each round, players deploy BNB onto the blocks they think will win. When the timer runs out, one winning block is randomly selected on-chain. All BNB from the 24 losing blocks is collected, the protocol takes a 10% vault fee, and the remaining 90% is redistributed to miners on the winning block — proportional to how much each player deployed.</p>
                    <p style={{ margin: 0 }}>On top of BNB rewards, approximately 1 BEANS token is minted each round and awarded to a miner on the winning block. A growing jackpot called the Beanpot can trigger at any time, distributing a potentially massive BEANS bonus. And a unique roasting mechanic rewards patient miners who delay claiming their earned BEANS.</p>
                    <SectionImage alt="BEANS mining grid overview" placeholder="beansmininggrid.png" maxWidth="520px" />
                    <div style={isMobile ? styles.infoBoxMobile : styles.infoBox}>
                        <strong>Why BEANS?</strong>
                        <p style={{ margin: "12px 0 0 0" }}>Just like coffee beans need to be roasted to reach their full potential, BEANS tokens reward patience. When you win BEANS, they start as &quot;unroasted&quot; — raw and unclaimed. A 10% roasting fee is applied when you claim, and that fee is redistributed to other miners still holding unclaimed BEANS. The longer you let your BEANS roast, the more roasted BEANS you accumulate from others claiming before you.</p>
                    </div>
                </div>
            ),
        },
        "getting-started": {
            title: "Getting Started",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}>Getting started with BEANS takes less than a minute. All you need is a Web3 wallet with some BNB on the BNB Smart Chain (BSC) network.</p>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>What You Need</h3>
                        <ol style={{ ...styles.list, gap: listGap }}>
                            <li><strong>A Web3 wallet</strong> — MetaMask, Trust Wallet, Rabby, or any WalletConnect-compatible wallet. Make sure it&apos;s configured for the BNB Smart Chain network.</li>
                            <li><strong>BNB for mining</strong> — This is what you deploy on the grid each round. You can start with as little as 0.001 BNB to get a feel for the game.</li>
                            <li><strong>A small amount of BNB for gas</strong> — Transaction fees on BSC are very low (typically under $0.05 per transaction).</li>
                        </ol>
                    </div>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Connect Your Wallet</h3>
                        <p style={{ margin: 0 }}>Click the <strong>Connect Wallet</strong> button in the top-right corner. Select your wallet provider and approve the connection. Once connected, you&apos;ll see your truncated address displayed in the header.</p>
                    </div>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Your Account</h3>
                        <p style={{ margin: 0 }}>Click your address in the header to open the Account panel. Here you can see:</p>
                        <ul style={{ ...styles.list, gap: listGap, marginTop: "12px" }}>
                            <li><strong>Wallet Address</strong> — Your connected address with a copy button for easy sharing.</li>
                            <li><strong>BNB Balance</strong> — Your current BNB balance on BSC, used for deploying and gas fees.</li>
                            <li><strong>Portfolio</strong> — Your BEANS token breakdown across three categories: Wallet (BEANS in your wallet), Staked (BEANS deposited in the staking contract), and Rewards (unclaimed staking rewards).</li>
                        </ul>
                        <SectionImage alt="Account panel showing wallet and portfolio" placeholder="accountpanel.png" maxWidth="280px" />
                    </div>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Live Price Feeds</h3>
                        <p style={{ margin: 0 }}>The header displays real-time prices for both BEANS and BNB. The BEANS price is pulled from the on-chain BEAN/BNB liquidity pool on PancakeSwap, and the BNB price comes from Binance. These update automatically so you always know the current value of your holdings.</p>
                    </div>
                    <div style={isMobile ? styles.infoBoxMobile : styles.infoBox}>
                        <strong>Quick Start</strong>
                        <p style={{ margin: "12px 0 0 0" }}>Once connected, you&apos;re ready to mine. Head to the main page, select some blocks on the grid, enter a BNB amount, and hit Deploy. Your first round takes about 60 seconds to settle — watch the elimination animation and see if your blocks win. Check the About sections below to understand the full mechanics before deploying larger amounts.</p>
                    </div>
                </div>
            ),
        },
        mining: {
            title: "Mining",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}>Mining is the core mechanic of BEANS. Rounds run continuously — one every 60 seconds — on a 5×5 grid of 25 blocks. Each round is an independent game with its own set of deployments, a randomly selected winner, and immediate payouts.</p>
                    <SectionImage alt="BEANS mining grid with active round" placeholder="beansmininggrid.png" maxWidth="520px" />
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>How a Round Works</h3>
                        <ol style={{ ...styles.list, gap: listGap }}>
                            <li><strong>Select your blocks</strong> — Click on any of the 25 blocks on the grid. You can select as few as 1 or as many as all 25. Selected blocks are highlighted with a yellow border. Each block shows the total BNB deployed on it by all miners and the number of miners on that block.</li>
                            <li><strong>Set your per-block amount</strong> — Enter how much BNB to deploy per block in the controls panel. The minimum is 0.00001 BNB per block. Your total cost is calculated as the per-block amount multiplied by the number of blocks selected.</li>
                            <li><strong>Deploy</strong> — Hit the Deploy button to submit your transaction on-chain. Once confirmed, your blocks are locked in for the round and shown with a green border and checkmark. You can only deploy once per round — the smart contract enforces this.</li>
                            <li><strong>Round settles</strong> — When the 60-second timer expires, blocks are eliminated one by one in a rapid animation until only the winning block remains. The winning block is selected using a secure on-chain random number that cannot be predicted or manipulated.</li>
                            <li><strong>Rewards distributed</strong> — All BNB from losing blocks is collected. The protocol takes a 10% vault fee, and the remaining 90% is distributed to miners on the winning block, proportional to each miner&apos;s share of that block.</li>
                        </ol>
                    </div>
                    <SideBySideImages left={{ alt: "Manual controls panel", placeholder: "manualcontrolpanel.png" }} right={{ alt: "Auto controls panel", placeholder: "autocontrolpanel.png" }} />
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Example</h3>
                        <div style={isMobile ? styles.infoBoxMobile : styles.infoBox}>
                            <p style={{ margin: 0 }}>You deploy <strong>0.01 BNB</strong> on Block #7. Across all 25 blocks, a total of <strong>0.5 BNB</strong> is deployed this round. Block #7 has a total of <strong>0.15 BNB</strong> from all miners, making your share of the block <strong>6.67%</strong> (0.01 / 0.15).</p>
                            <p style={{ margin: "12px 0 0 0" }}>Block #7 wins. The 24 losing blocks contributed 0.35 BNB. After the 10% vault fee (0.05 BNB from the total 0.5 BNB), the prize pool is <strong>0.45 BNB</strong>. Your 6.67% share of the winning block earns you <strong>0.03 BNB</strong> — a 3× return on your 0.01 BNB deployment.</p>
                            <p style={{ margin: "12px 0 0 0" }}>You also have a chance at the ~1 BEANS token reward and, if triggered, a share of the Beanpot.</p>
                        </div>
                    </div>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>What You See on the Grid</h3>
                        <p style={{ margin: 0 }}>Each block on the grid displays two pieces of information in real time: the total BNB deployed on it and the number of miners. This updates live as other players deploy during the round. After the round settles, the winning block is highlighted in gold before the grid resets for the next round.</p>
                    </div>
                </div>
            ),
        },
        beanpot: {
            title: "The Beanpot",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}>The <strong>Beanpot</strong> is a growing BEANS jackpot that can trigger on any round. It adds a lottery-style element to every round of mining — a potentially massive bonus on top of normal rewards.</p>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>How It Works</h3>
                        <ol style={{ ...styles.list, gap: listGap }}>
                            <li>Each round, <strong>0.2 BEANS</strong> is added to the Beanpot from the round&apos;s token emission.</li>
                            <li>Every round has a <strong>1-in-625 chance</strong> (0.16%) of triggering the Beanpot.</li>
                            <li>If triggered, the entire accumulated Beanpot is distributed among the round&apos;s winners, proportional to their deployment on the winning block.</li>
                            <li>If not triggered, the pool carries over and continues growing — making the next potential payout even larger.</li>
                        </ol>
                    </div>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Beanpot Math</h3>
                        <div style={isMobile ? styles.infoBoxMobile : styles.infoBox}>
                            <p style={{ margin: 0 }}>At 0.2 BEANS per round with rounds every 60 seconds, the Beanpot grows by roughly <strong>288 BEANS per day</strong> (1,440 rounds × 0.2 BEANS). On average, it triggers once every ~625 rounds (~10.4 hours), creating an expected pool of <strong>~125 BEANS</strong> at the time of trigger.</p>
                            <p style={{ margin: "12px 0 0 0" }}>However, variance plays a major role. The Beanpot might trigger after just a few rounds with a tiny pool, or accumulate for thousands of rounds creating a jackpot worth hundreds of BEANS. This unpredictability is intentional — consistent mining maximizes your chances of being present when a large Beanpot triggers.</p>
                        </div>
                    </div>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Example</h3>
                        <div style={isMobile ? styles.infoBoxMobile : styles.infoBox}>
                            <p style={{ margin: 0 }}>The Beanpot has accumulated <strong>200 BEANS</strong> over ~1,000 rounds without triggering. This round, it triggers. You deployed 0.02 BNB on the winning block, which has 0.1 BNB total. Your <strong>20% share</strong> earns you <strong>40 BEANS</strong> from the Beanpot — on top of your normal BNB rewards and BEAN reward for the round.</p>
                        </div>
                    </div>
                </div>
            ),
        },
        "bean-rewards": {
            title: "BEAN Rewards",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}>Every round, approximately <strong>1 BEANS token</strong> is minted and awarded to miners on the winning block. This is the primary way new BEANS enter circulation — there is no pre-mine or team allocation. Every BEANS in existence was earned through mining.</p>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>How the Winner is Chosen</h3>
                        <p style={{ margin: 0 }}>The BEANS reward recipient is determined on-chain using a weighted random selection. Miners who deployed more BNB to the winning block have a proportionally higher chance of receiving the full ~1 BEANS reward. The selection uses a verifiable random seed from the settlement transaction, so outcomes are fair and tamper-proof.</p>
                    </div>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Split Rounds</h3>
                        <p style={{ margin: 0 }}>Some rounds result in a <strong>split</strong> instead of a single winner. In split rounds, the ~1 BEANS reward is divided among all miners on the winning block proportional to their deployment, rather than going to one person. This balances occasional large payouts with more frequent smaller ones. Split rounds are indicated with a &quot;Split&quot; badge in the mining history on the Global page.</p>
                    </div>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Example</h3>
                        <div style={isMobile ? styles.infoBoxMobile : styles.infoBox}>
                            <p style={{ margin: 0 }}><strong>Non-split round:</strong> Three miners are on the winning block with 0.05, 0.03, and 0.02 BNB deployed. The weighted random selection gives the miner with 0.05 BNB a 50% chance, the 0.03 BNB miner a 30% chance, and the 0.02 BNB miner a 20% chance. One of them receives the full ~1 BEANS.</p>
                            <p style={{ margin: "12px 0 0 0" }}><strong>Split round:</strong> Same three miners. The ~1 BEANS is split proportionally: 0.5 BEANS, 0.3 BEANS, and 0.2 BEANS respectively.</p>
                        </div>
                    </div>
                </div>
            ),
        },
        roasting: {
            title: "Roasting",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}><strong>Roasting</strong> is the mechanism that rewards patient miners. When you win BEANS from mining, they accumulate as &quot;unroasted&quot; tokens in the smart contract until you choose to claim them. The longer you wait, the more you earn from other miners claiming before you.</p>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>How It Works</h3>
                        <ol style={{ ...styles.list, gap: listGap }}>
                            <li><strong>Win BEANS</strong> — Your mining rewards accumulate as unroasted BEANS in the contract. You can see your unroasted balance in the Rewards panel.</li>
                            <li><strong>Others claim</strong> — When another miner claims their BEANS, a 10% roasting fee is deducted from their unroasted balance. This fee is redistributed proportionally to all miners still holding unclaimed BEANS — including you.</li>
                            <li><strong>Your roasted balance grows</strong> — Every time someone else claims, you receive a share of their roasting fee based on the size of your unclaimed balance relative to the total unclaimed pool. Your roasted BEANS are shown separately in the Rewards panel.</li>
                            <li><strong>Claim when ready</strong> — When you claim, you receive your unroasted BEANS (minus the 10% fee) plus all your accumulated roasted BEANS. The fee from your claim then flows to the remaining holders.</li>
                        </ol>
                    </div>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Example</h3>
                        <div style={isMobile ? styles.infoBoxMobile : styles.infoBox}>
                            <p style={{ margin: 0 }}>You have <strong>10 unroasted BEANS</strong> sitting unclaimed. The total unclaimed pool across all miners is <strong>1,000 BEANS</strong> — so you hold 1% of the pool.</p>
                            <p style={{ margin: "12px 0 0 0" }}>Another miner claims 100 BEANS and pays <strong>10 BEANS</strong> as the roasting fee. That 10 BEANS is redistributed to everyone holding unclaimed BEANS. Your 1% share earns you <strong>0.1 roasted BEANS</strong> — added to your balance automatically without you doing anything.</p>
                            <p style={{ margin: "12px 0 0 0" }}>Over time, as more miners claim, your roasted balance compounds. If you hold for weeks while actively mining, the accumulated roasted BEANS can become a significant bonus on top of your mining rewards.</p>
                        </div>
                    </div>
                    <div style={isMobile ? styles.infoBoxMobile : styles.infoBox}>
                        <strong>The Patience Game</strong>
                        <p style={{ margin: "12px 0 0 0" }}>Roasting creates a strategic tension: claim early and pay the 10% fee, or hold longer and benefit from others claiming before you. There&apos;s no lock-up — you can claim anytime — but the incentive structure rewards patience. Some miners delay claiming for weeks or months to maximize compounding. The tradeoff is that your BEANS sit in the contract rather than your wallet until you decide to claim.</p>
                    </div>
                </div>
            ),
        },
        autominer: {
            title: "AutoMiner",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}>The <strong>AutoMiner</strong> lets you mine across multiple rounds without manually deploying each time. Deposit BNB upfront, configure your strategy, and the protocol handles deployment on your behalf every round until your balance runs out or you stop it.</p>
                    <p style={{ margin: 0 }}>This is especially useful for maximizing Beanpot chances and roasting fee accumulation — consistent presence across many rounds is more profitable than sporadic manual mining.</p>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>How It Works</h3>
                        <ol style={{ ...styles.list, gap: listGap }}>
                            <li><strong>Choose a strategy</strong> — Select between <strong>All Blocks</strong> (deploys to all 25 blocks every round, guaranteeing you&apos;re on the winner) or <strong>Random</strong> (deploys to a set number of randomly selected blocks each round for higher risk/reward).</li>
                            <li><strong>Set rounds and amount</strong> — Choose how many rounds to run and your BNB per block. The interface calculates your total deposit, per-round cost, and shows exactly what you&apos;ll be spending.</li>
                            <li><strong>Activate</strong> — A single transaction deposits your BNB into the AutoMiner contract and starts it. From that point, the protocol deploys on your behalf each round automatically.</li>
                            <li><strong>Monitor</strong> — While active, you can see your remaining balance, rounds executed vs total, strategy, and per-block amount in the controls panel. Your auto-deployed blocks are highlighted green on the grid each round.</li>
                            <li><strong>Stop anytime</strong> — Hit Stop to deactivate the AutoMiner. Any remaining unspent BNB is refunded to your wallet immediately.</li>
                        </ol>
                    </div>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Executor Fee</h3>
                        <p style={{ margin: 0 }}>The AutoMiner charges a <strong>1% executor fee</strong> on your deposit to cover the gas costs of executing deployments on your behalf each round. This is deducted from your deposit upfront — the per-block and per-round amounts shown in the interface already account for this fee, so what you see is what gets deployed.</p>
                    </div>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Example</h3>
                        <div style={isMobile ? styles.infoBoxMobile : styles.infoBox}>
                            <p style={{ margin: 0 }}>You activate AutoMiner with the <strong>All Blocks</strong> strategy, <strong>0.001 BNB per block</strong>, for <strong>100 rounds</strong>. Total deposit: 25 blocks × 0.001 BNB × 100 rounds = <strong>2.5 BNB</strong> + 1% executor fee = <strong>2.525 BNB</strong>.</p>
                            <p style={{ margin: "12px 0 0 0" }}>Each round, 0.025 BNB is deployed across all 25 blocks. Since you&apos;re on every block, you&apos;re guaranteed to be on the winning block every round. After the 10% vault fee, you receive back ~90% of the total pot each round minus what other winners on the same block earn. You also accumulate BEANS rewards and Beanpot chances across all 100 rounds.</p>
                            <p style={{ margin: "12px 0 0 0" }}>After 73 rounds, you decide to stop. The remaining 27 rounds&apos; worth of BNB is refunded to your wallet.</p>
                        </div>
                    </div>
                    <div style={isMobile ? styles.infoBoxMobile : styles.infoBox}>
                        <strong>Grid Lock</strong>
                        <p style={{ margin: "12px 0 0 0" }}>While AutoMiner is active, the mining grid is locked — you can&apos;t manually select or deploy blocks. This prevents conflicts between manual and automatic deployments. The Manual mining tab is hidden and replaced with your AutoMiner status display.</p>
                    </div>
                </div>
            ),
        },
        strategy: {
            title: "Strategy",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}>There&apos;s no single &quot;correct&quot; strategy in BEANS — it depends on your risk tolerance, bankroll, and goals. Here are the main approaches and how to think about them.</p>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Block Selection</h3>
                        <ul style={{ ...styles.list, gap: listGap }}>
                            <li><strong>Fewer blocks (1–5): High risk, high reward</strong> — Each block has a 1-in-25 (4%) chance of winning. Selecting 3 blocks gives you a 12% chance of winning each round. When you win, your payout is large relative to your deployment because you&apos;re only paying for a few blocks.</li>
                            <li><strong>More blocks (10–20): Moderate risk</strong> — Selecting 15 blocks gives you a 60% chance of winning each round. Wins are more frequent but smaller, since you&apos;re paying for more blocks.</li>
                            <li><strong>All 25 blocks: Zero risk on block selection</strong> — You&apos;re guaranteed to be on the winning block every round. After the 10% vault fee, you receive back roughly 90% of the total pot. This means you&apos;re effectively paying ~10% per round for guaranteed participation in BEANS rewards and Beanpot chances.</li>
                        </ul>
                    </div>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Maximizing Returns</h3>
                        <ul style={{ ...styles.list, gap: listGap }}>
                            <li><strong>Mine consistently</strong> — Sporadic mining means you&apos;ll miss Beanpot triggers and roasting fee accumulation. Mining 100 consecutive rounds is far more valuable than 100 rounds spread across weeks. Use AutoMiner to stay in every round.</li>
                            <li><strong>Delay claiming BEANS</strong> — Your unclaimed balance earns roasting fees from every other miner who claims before you. The longer you hold, the more your roasted balance compounds. Some miners hold for weeks or months.</li>
                            <li><strong>Stake your claimed BEANS</strong> — Once you do claim, stake your BEANS to earn yield from protocol buybacks. This creates a full cycle: mine → hold (roast) → claim → stake → earn yield.</li>
                            <li><strong>Watch the Beanpot</strong> — When the Beanpot is high, it&apos;s an especially good time to be mining. Every round it doesn&apos;t trigger makes the next potential payout larger.</li>
                        </ul>
                    </div>
                    <div style={{ ...styles.warningBox, ...(isMobile ? { padding: "14px", fontSize: "13px" } : {}) }}>
                        <strong>⚠️ Risk Disclaimer</strong>
                        <p style={{ margin: "12px 0 0 0" }}>BEANS mining involves financial risk. Only one block wins each round — the other 24 blocks lose their deployed BNB. If your selected blocks don&apos;t include the winner, your BNB for that round goes to the winners. Most rounds will result in losses for most participants. You only profit when you&apos;re on the winning block and your share of the rewards exceeds your deployment.</p>
                        <p style={{ margin: "12px 0 0 0" }}>Even covering all 25 blocks guarantees being on the winner but still costs ~10% per round in vault fees. There are no guaranteed ways to profit. Never deploy more than you can afford to lose.</p>
                    </div>
                </div>
            ),
        },
        supply: {
            title: "Supply",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}>BEANS has a fixed maximum supply with zero initial allocation. Every token in circulation was minted through mining — there is no pre-mine, team allocation, or investor distribution. This is a <strong>fair launch</strong> in the truest sense.</p>
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
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Supply Timeline</h3>
                        <div style={isMobile ? styles.infoBoxMobile : styles.infoBox}>
                            <p style={{ margin: 0 }}>At ~1 BEANS per round and 1,440 rounds per day, raw emission is approximately <strong>1,440 BEANS per day</strong>. However, the burn mechanism (90% of protocol buybacks are burned) works against emission. As mining activity increases and more BNB is deployed, the burn rate scales up — creating the potential for net deflation where more BEANS are burned than minted.</p>
                        </div>
                    </div>
                </div>
            ),
        },
        "protocol-revenue": {
            title: "Protocol Revenue",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}>The protocol generates revenue by taking a <strong>10% vault fee</strong> from all BNB deployed in mining rounds. This revenue doesn&apos;t sit idle — it actively supports the BEANS token through automated buybacks and burns.</p>
                    <SectionImage alt="Global page showing protocol revenue stats" placeholder="protocolrev.png" maxWidth="680px" />
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Revenue Flow</h3>
                        <ol style={{ ...styles.list, gap: listGap }}>
                            <li><strong>Collection</strong> — 10% of all BNB deployed each round is sent to the Treasury contract. This happens automatically on-chain every round.</li>
                            <li><strong>Buyback</strong> — The Treasury periodically uses accumulated BNB to buy BEANS from the BEAN/BNB liquidity pool on PancakeSwap.</li>
                            <li><strong>Burn</strong> — 90% of purchased BEANS are permanently burned — removed from circulation forever.</li>
                            <li><strong>Staker Rewards</strong> — The remaining 10% of purchased BEANS are distributed to BEANS stakers as yield.</li>
                        </ol>
                    </div>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Revenue Allocation</h3>
                        <table style={styles.table}>
                            <tbody>
                                <tr><td style={isMobile ? styles.tableLabelMobile : styles.tableLabel}>Source</td><td style={isMobile ? styles.tableValueMobile : styles.tableValue}>10% of all deployed BNB</td></tr>
                                <tr><td style={isMobile ? styles.tableLabelMobile : styles.tableLabel}>Buyback &amp; Burn</td><td style={isMobile ? styles.tableValueMobile : styles.tableValue}>90% of buyback</td></tr>
                                <tr><td style={isMobile ? styles.tableLabelMobile : styles.tableLabel}>Staker Rewards</td><td style={isMobile ? styles.tableValueMobile : styles.tableValue}>10% of buyback</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div style={isMobile ? styles.infoBoxMobile : styles.infoBox}>
                        <strong>Transparency</strong>
                        <p style={{ margin: "12px 0 0 0" }}>All buyback transactions are recorded on-chain and visible on the Global page under the Revenue tab. You can see exactly how much BNB was spent, how much BEANS was burned, and how much yield was generated for stakers — all verifiable on BSCScan.</p>
                    </div>
                </div>
            ),
        },
        burn: {
            title: "Burn Mechanism",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}>BEANS is designed to be <strong>deflationary</strong>. While new tokens are minted through mining (~1 per round), the burn mechanism works to offset and eventually exceed emission — creating an increasingly scarce token over time.</p>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>How Burns Work</h3>
                        <ol style={{ ...styles.list, gap: listGap }}>
                            <li>The Treasury collects 10% of all deployed BNB as protocol revenue.</li>
                            <li>This BNB is used to buy BEANS from the on-chain BEAN/BNB liquidity pool.</li>
                            <li>90% of purchased BEANS are sent to the burn address — permanently removed from circulation.</li>
                            <li>The remaining 10% is distributed to stakers.</li>
                        </ol>
                    </div>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Deflationary Dynamics</h3>
                        <div style={isMobile ? styles.infoBoxMobile : styles.infoBox}>
                            <p style={{ margin: 0 }}>The more BNB deployed across rounds, the more revenue the protocol generates, and the more BEANS are burned. This creates a positive feedback loop: increased mining activity → more vault fees collected → more buybacks → more tokens burned → increased scarcity.</p>
                            <p style={{ margin: "12px 0 0 0" }}>At high enough mining volumes, the burn rate can exceed the emission rate of ~1,440 BEANS per day — making the circulating supply actively shrink. Current burn totals and buyback history are visible on the Global stats page.</p>
                        </div>
                    </div>
                </div>
            ),
        },
        staking: {
            title: "Staking",
            content: (
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap }}>
                    <p style={{ margin: 0 }}>Stake your BEANS tokens to earn a share of protocol revenue. Stakers receive 10% of all BEANS purchased through Treasury buybacks as yield, distributed proportionally based on stake size.</p>
                    <SectionImage alt="Staking page interface" placeholder="stake.png" maxWidth="440px" />
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>How Staking Works</h3>
                        <ol style={{ ...styles.list, gap: listGap }}>
                            <li><strong>Deposit BEANS</strong> — Stake your BEANS tokens into the staking contract. Your staked balance earns yield immediately.</li>
                            <li><strong>Earn yield</strong> — Each time the Treasury executes a buyback, 10% of the purchased BEANS is distributed to stakers proportional to their stake. If you hold 5% of all staked BEANS, you receive 5% of the yield.</li>
                            <li><strong>Claim rewards</strong> — Accumulated staking rewards can be claimed at any time. They don&apos;t compound automatically — claimed rewards go to your wallet.</li>
                            <li><strong>Withdraw</strong> — Unstake your BEANS whenever you want. There is no lock-up period, no cooldown, no penalty.</li>
                        </ol>
                    </div>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>Staking Summary</h3>
                        <p style={{ margin: 0 }}>The Stake page displays key metrics so you can evaluate staking at a glance:</p>
                        <ul style={{ ...styles.list, gap: listGap, marginTop: "12px" }}>
                            <li><strong>Total Deposits</strong> — The total amount of BEANS staked across all stakers.</li>
                            <li><strong>APR</strong> — The current annualized percentage return based on recent buyback activity and total staked amount.</li>
                            <li><strong>TVL</strong> — Total Value Locked, showing the dollar value of all staked BEANS.</li>
                        </ul>
                    </div>
                    <div>
                        <h3 style={isMobile ? styles.h3Mobile : styles.h3}>APR Calculator</h3>
                        <p style={{ margin: 0 }}>The APR Calculator lets you estimate your potential staking returns before committing. Enter the amount of BEANS you plan to stake and it calculates your projected daily, weekly, monthly, and yearly yield based on the current APR and protocol activity. This helps you decide how much to stake and set realistic expectations for your earnings.</p>
                        <SectionImage alt="APR Calculator" placeholder="apr.png" maxWidth="440px" />
                    </div>
                    <div style={isMobile ? styles.infoBoxMobile : styles.infoBox}>
                        <strong>Staking vs Roasting</strong>
                        <p style={{ margin: "12px 0 0 0" }}>These are two separate reward streams that work together:</p>
                        <p style={{ margin: "8px 0 0 0" }}><strong>Roasting</strong> — Passive rewards from holding unclaimed BEANS. Funded by the 10% roasting fee when other miners claim. Benefits miners who delay claiming.</p>
                        <p style={{ margin: "8px 0 0 0" }}><strong>Staking</strong> — Active yield from depositing claimed BEANS into the staking contract. Funded by the Treasury buyback cycle (10% of vault fees → buyback → 10% to stakers).</p>
                        <p style={{ margin: "8px 0 0 0" }}>The optimal flow: mine → hold unclaimed BEANS to accumulate roasting rewards → claim when ready → stake claimed BEANS → earn staking yield. Both streams reward long-term participation.</p>
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
                        <p style={{ margin: "12px 0 0 0" }}>BEANS is a gamified mining protocol on BNB Chain. Players deploy BNB on a 5×5 grid in 60-second rounds, competing to land on the randomly selected winning block and earn BNB rewards plus BEANS tokens. It&apos;s a fair-launch protocol with zero pre-mine or team allocation.</p>
                    </div>
                    <div style={styles.faqItem}>
                        <h4 style={isMobile ? styles.h4Mobile : styles.h4}>Can I lose my BNB?</h4>
                        <p style={{ margin: "12px 0 0 0" }}>Yes. If none of your selected blocks are the winning block, your deployed BNB goes to the winners. You can reduce risk by deploying on more blocks, or eliminate block selection risk entirely by covering all 25 — though the 10% vault fee means you&apos;ll always receive back less than the total pot.</p>
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
                        <p style={{ margin: "12px 0 0 0" }}>A growing BEANS jackpot funded by 0.2 BEANS per round. Each round has a 1-in-625 chance of triggering it. On average it triggers roughly every 10 hours, but the timing is random — it could trigger much sooner or accumulate much larger.</p>
                    </div>
                    <div style={styles.faqItem}>
                        <h4 style={isMobile ? styles.h4Mobile : styles.h4}>What is roasting?</h4>
                        <p style={{ margin: "12px 0 0 0" }}>When you claim earned BEANS, a 10% roasting fee is deducted and redistributed to other miners still holding unclaimed BEANS. By delaying your claim, you accumulate &quot;roasted&quot; BEANS from other players&apos; fees. It&apos;s a patience mechanic — the longer you hold, the more you earn.</p>
                    </div>
                    <div style={styles.faqItem}>
                        <h4 style={isMobile ? styles.h4Mobile : styles.h4}>What does the AutoMiner do?</h4>
                        <p style={{ margin: "12px 0 0 0" }}>AutoMiner lets you deposit BNB upfront and automatically deploy across multiple rounds without manual intervention. Choose a strategy (all blocks or random), set how many rounds to run, and the protocol handles deployment each round. A 1% executor fee covers gas costs. You can stop and refund remaining BNB anytime.</p>
                    </div>
                    <div style={styles.faqItem}>
                        <h4 style={isMobile ? styles.h4Mobile : styles.h4}>Where does protocol revenue come from?</h4>
                        <p style={{ margin: "12px 0 0 0" }}>10% of all BNB deployed in mining rounds is collected as a vault fee. This BNB is used by the Treasury to buy BEANS from the liquidity pool — 90% is burned permanently and 10% goes to stakers as yield.</p>
                    </div>
                    <div style={styles.faqItem}>
                        <h4 style={isMobile ? styles.h4Mobile : styles.h4}>Is there a token pre-mine or team allocation?</h4>
                        <p style={{ margin: "12px 0 0 0" }}>No. BEANS launched with zero initial supply. Every token in circulation was minted through mining rounds. The max supply is capped at 3,000,000 BEANS in the smart contract.</p>
                    </div>
                    <div style={styles.faqItem}>
                        <h4 style={isMobile ? styles.h4Mobile : styles.h4}>How is the winning block selected?</h4>
                        <p style={{ margin: "12px 0 0 0" }}>The winning block is determined by a secure on-chain random number generated during the round settlement transaction. This ensures fair, verifiable, and tamper-proof outcomes every round.</p>
                    </div>
                    <div style={styles.faqItem}>
                        <h4 style={isMobile ? styles.h4Mobile : styles.h4}>Which wallets are supported?</h4>
                        <p style={{ margin: "12px 0 0 0" }}>Any wallet that supports BNB Smart Chain and WalletConnect — including MetaMask, Trust Wallet, Rabby, Coinbase Wallet, and more. Connect via the button in the top-right corner of the page.</p>
                    </div>
                    <div style={styles.faqItem}>
                        <h4 style={isMobile ? styles.h4Mobile : styles.h4}>How much BNB do I need to start?</h4>
                        <p style={{ margin: "12px 0 0 0" }}>You can start with as little as 0.001 BNB to try the game. The minimum deployment is 0.00001 BNB per block. You&apos;ll also need a small amount for gas fees, which are typically under $0.05 per transaction on BSC.</p>
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
    warningBox: { background: "#1a1a0a", border: "1px solid #443300", borderRadius: "12px", padding: "20px", marginTop: "8px" },
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
