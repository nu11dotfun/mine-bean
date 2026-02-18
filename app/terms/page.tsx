'use client'

import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import { useState, useEffect } from 'react'

export default function Terms() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const heading = { fontSize: isMobile ? 20 : 24, fontWeight: 700 as const, color: '#fff', margin: '40px 0 16px' }
  const subheading = { fontSize: isMobile ? 17 : 19, fontWeight: 600 as const, color: '#fff', margin: '28px 0 12px' }
  const text = { fontSize: isMobile ? 14 : 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8, margin: '0 0 16px' }
  const bold = { color: 'rgba(255,255,255,0.85)', fontWeight: 600 as const }
  const caps = { ...text, textTransform: 'uppercase' as const, fontWeight: 600 as const, color: 'rgba(255,255,255,0.5)', fontSize: isMobile ? 12 : 13 }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', paddingBottom: isMobile ? '80px' : '0' }}>
      <Header currentPage="about" isMobile={isMobile} />
      <div style={{ maxWidth: 1200, margin: '0', padding: isMobile ? '32px 20px 60px' : '48px 40px 80px 160px' }}>

        <h1 style={{ fontSize: isMobile ? 28 : 36, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>Terms of Service</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', margin: '0 0 40px' }}>Effective Date: February 18, 2026</p>

        <p style={text}>These Terms of Service (<span style={bold}>&quot;Terms&quot;</span>) govern your access to and use of the website located at <span style={bold}>minebean.com</span> (the <span style={bold}>&quot;Website&quot;</span>) and the associated services (collectively, the <span style={bold}>&quot;Services&quot;</span>) provided by BEAN Protocol (<span style={bold}>&quot;we,&quot; &quot;us,&quot;</span> or <span style={bold}>&quot;our&quot;</span>). The Services consist of a frontend interface to facilitate interaction with the BEAN mining protocol (the <span style={bold}>&quot;Protocol&quot;</span>), a decentralized application operating on the Base blockchain. By accessing or using the Website or Services, you (<span style={bold}>&quot;User,&quot; &quot;you,&quot;</span> or <span style={bold}>&quot;your&quot;</span>) agree to be bound by these Terms. If you do not agree, you must not access or use the Website or Services.</p>

        <p style={text}>The Services are intended for users who are at least 18 years old or the age of majority in their jurisdiction, whichever is greater. By using the Services, you represent and warrant that you meet this eligibility requirement and have the legal capacity to enter into these Terms.</p>

        <p style={caps}>PLEASE READ THESE TERMS CAREFULLY. THEY CONTAIN IMPORTANT PROVISIONS REGARDING ASSUMPTION OF RISK, LIMITATION OF LIABILITY, DISCLAIMER OF WARRANTIES, AND DISPUTE RESOLUTION.</p>

        <h2 style={heading}>1. Description of Services</h2>
        <p style={text}>The Website provides a frontend interface for users to interact with the BEAN mining protocol, a decentralized application running on the Base blockchain. The Protocol operates through smart contracts and functions as follows:</p>
        <p style={text}>(a) Users select one or more blocks on a 5x5 grid and deploy ETH (Ethereum) to claim space on those blocks.</p>
        <p style={text}>(b) Each mining round lasts approximately 60 seconds.</p>
        <p style={text}>(c) A single winning block is selected per round via a verifiable random process on the Base blockchain.</p>
        <p style={text}>(d) ETH deployed on losing blocks is aggregated and distributed to users with claims on the winning block, proportional to their claim sizes.</p>
        <p style={text}>(e) The Beanpot jackpot mechanism may be triggered under specific on-chain conditions defined in the smart contract, awarding accumulated BEAN tokens to qualifying participants.</p>
        <p style={text}>(f) 10% of all distributed ETH is automatically allocated by the Protocol to BEAN token staking rewards. 90% is allocated to BEAN token buyback-and-burn operations, reducing circulating supply.</p>
        <p style={text}>The Protocol is permissionless and wallet-based, requiring no user registration or account creation to participate in mining. Users interact directly with the Protocol&apos;s smart contracts via their non-custodial cryptocurrency wallets (such as MetaMask, Coinbase Wallet, or other wallets supported through RainbowKit). All transactions are irreversible and recorded on the public Base blockchain. We provide only the Website interface and do not custody user funds or control Protocol operations.</p>

        <h2 style={heading}>2. Wallet Connection and User Profiles</h2>
        <p style={text}>To access the Services, you must use non-custodial wallet software which allows you to interact with the Base blockchain. Your relationship with your wallet provider is governed by their applicable terms of service.</p>
        <p style={text}>We do not have custody or control over the contents of your wallet and have no ability to retrieve or transfer its contents. <span style={bold}>By connecting your wallet to our Website, you agree to be bound by these Terms and all provisions incorporated herein by reference.</span></p>
        <p style={text}>The Website allows you to optionally create a user profile associated with your wallet address. Your username, profile picture, bio, linked social media accounts, and transaction history will be <span style={bold}>public and accessible by anyone.</span> You may not select a username that misappropriates or infringes the intellectual property rights of others, and you may not impersonate another person or entity. Purchasing, selling, or renting a username or profile is strictly prohibited. We reserve the right to revoke access to your username at our discretion without notice.</p>
        <p style={text}>This Agreement is not intended to, and does not, create or impose any fiduciary duties on us. To the fullest extent permitted by law, you acknowledge and agree that we owe no fiduciary duties or liabilities to you or any other party.</p>

        <h2 style={heading}>3. User Responsibilities and Conduct</h2>
        <h3 style={subheading}>3.1 Wallet and Security</h3>
        <p style={text}>You are solely responsible for securing your cryptocurrency wallet, private keys, and associated credentials. We do not store or have access to your private keys or funds. Any loss due to compromised wallets, phishing, or user error is your responsibility.</p>
        <h3 style={subheading}>3.2 Compliance with Laws</h3>
        <p style={text}>You must comply with all applicable laws, including but not limited to anti-money laundering (AML), counter-terrorism financing (CTF), sanctions, and tax laws in your jurisdiction. You represent that your use of the Services does not violate any laws.</p>
        <h3 style={subheading}>3.3 Taxes</h3>
        <p style={text}>You are solely responsible for reporting and paying any taxes arising from your use of the Services, including gains from cryptocurrency transactions. We do not provide tax advice, reporting, or withhold taxes on your behalf.</p>
        <h3 style={subheading}>3.4 Prohibited Activities</h3>
        <p style={text}>You agree not to:</p>
        <p style={text}>(a) Use the Services for illegal purposes, including money laundering, fraud, or terrorist financing.</p>
        <p style={text}>(b) Attempt to hack, reverse-engineer, or interfere with the Website, smart contracts, or blockchain.</p>
        <p style={text}>(c) Use bots, scripts, or automated tools to manipulate the Protocol or gain unfair advantages in mining rounds.</p>
        <p style={text}>(d) Transmit viruses, malware, or harmful code.</p>
        <p style={text}>(e) Infringe on intellectual property rights or harass other users.</p>
        <p style={text}>(f) Misrepresent your identity or engage in deceptive practices.</p>
        <p style={text}>(g) Use the Services in any manner that could interfere with, disrupt, negatively affect, or inhibit other users from fully enjoying the Services.</p>
        <p style={text}>(h) Use any robot, spider, crawler, scraper, or other automated means to access the Services or extract data.</p>
        <p style={text}>(i) Use the Services to engage in market manipulation, wash trading, or any form of fraudulent activity.</p>

        <h2 style={heading}>4. Risks and Disclaimers</h2>
        <p style={text}>Cryptocurrency and blockchain activities involve significant risks. By using the Services, you acknowledge and accept:</p>
        <p style={text}><span style={bold}>Volatility:</span> Cryptocurrencies like ETH and the BEAN token are highly volatile; their value may fluctuate dramatically and may go to zero.</p>
        <p style={text}><span style={bold}>No Guarantees:</span> There are no guarantees of rewards, profits, or returns. The Protocol is a decentralized mining game, not an investment. Past performance is not indicative of future results.</p>
        <p style={text}><span style={bold}>Loss of Funds:</span> You may lose some or all of the ETH you deploy in any given mining round. Round outcomes are determined by the Protocol&apos;s smart contracts and cannot be influenced or controlled by us.</p>
        <p style={text}><span style={bold}>Blockchain Risks:</span> Transactions are irreversible. Errors in wallet addresses, gas fees, network congestion, forks, or smart contract vulnerabilities may result in loss of funds.</p>
        <p style={text}><span style={bold}>Smart Contract Risks:</span> While the Protocol&apos;s smart contracts have been developed with care, they may contain bugs, vulnerabilities, or function in unexpected ways. We disclaim liability for any losses from smart contract failures.</p>
        <p style={text}><span style={bold}>Regulatory Risks:</span> Cryptocurrency regulations may change, potentially affecting the Services. You bear the risk of regulatory changes in your jurisdiction.</p>
        <p style={text}><span style={bold}>No Financial Advice:</span> Nothing in the Services constitutes financial, investment, legal, or tax advice. We are not a broker, dealer, exchange, investment adviser, custodian, or financial service provider of any kind. Consult professionals for personalized guidance.</p>
        <p style={text}><span style={bold}>Third-Party Risks:</span> The Services rely on third-party technologies (e.g., Base blockchain, wallet providers, RainbowKit, wagmi). We are not liable for their failures, outages, or vulnerabilities.</p>
        <p style={text}>You understand and agree to assume full responsibility for all of the risks of accessing and using the Services.</p>

        <h2 style={heading}>5. No Warranties</h2>
        <p style={caps}>THE SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.</p>
        <p style={caps}>WE DO NOT REPRESENT OR WARRANT THAT ACCESS TO THE WEBSITE WILL BE CONTINUOUS, UNINTERRUPTED, TIMELY, OR SECURE; THAT THE INFORMATION CONTAINED IN THE WEBSITE WILL BE ACCURATE, RELIABLE, COMPLETE, OR CURRENT; OR THAT THE WEBSITE WILL BE FREE FROM ERRORS, DEFECTS, VIRUSES, OR OTHER HARMFUL ELEMENTS.</p>

        <h2 style={heading}>6. Payments and Transactions</h2>
        <p style={text}>All transactions occur on the Base blockchain using ETH and the BEAN token. We do not process fiat payments or custody user assets.</p>
        <p style={text}>The Protocol charges fees on mining round activity. The current fee allocation is: 10% of distributed ETH to BEAN staking rewards and 90% to BEAN buyback-and-burn operations. Fee structures may change from time to time.</p>
        <p style={text}>Blockchain network fees (gas fees) are your responsibility and are paid directly to the Base network, not to us.</p>
        <p style={text}><span style={bold}>No Refunds:</span> Due to the immutable nature of blockchain, all transactions are final and non-refundable. This includes ETH deployed in mining rounds, staking transactions, and any fees.</p>
        <p style={text}><span style={bold}>BEAN Token:</span> BEAN is a utility token within the Protocol ecosystem. It has no guaranteed value and is not an investment security. Token values fluctuate based on market conditions.</p>

        <h2 style={heading}>7. Third-Party Services</h2>
        <p style={text}>The Website integrates with or relies upon the following third-party services:</p>
        <p style={text}>(a) <span style={bold}>RainbowKit</span> — Wallet connection user interface</p>
        <p style={text}>(b) <span style={bold}>wagmi</span> — Blockchain interaction library</p>
        <p style={text}>(c) <span style={bold}>Base (Coinbase L2)</span> — The underlying blockchain network</p>
        <p style={text}>(d) <span style={bold}>Cloudflare</span> — Content delivery and asset hosting</p>
        <p style={text}>(e) <span style={bold}>Vercel</span> — Website hosting and deployment</p>
        <p style={text}>We do not control, endorse, or assume responsibility for any third-party services, content, or functionality. Your use of third-party services is at your own risk and subject to their respective terms and conditions.</p>

        <h2 style={heading}>8. Limitation of Liability</h2>
        <p style={caps}>TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE, OUR AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, GOODWILL, DIGITAL ASSETS, OR OTHER INTANGIBLE LOSSES, ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
        <p style={caps}>IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU FOR ALL DAMAGES EXCEED THE AMOUNT OF ONE HUNDRED U.S. DOLLARS ($100.00 USD). THE FOREGOING DISCLAIMER WILL NOT APPLY TO THE EXTENT PROHIBITED BY LAW.</p>

        <h2 style={heading}>9. Indemnification</h2>
        <p style={text}>You agree to indemnify, defend, and hold harmless BEAN Protocol and its affiliates from and against any and all claims, damages, obligations, losses, liabilities, costs, and expenses (including attorneys&apos; fees) arising from: (a) your access to and use of the Services; (b) your violation of any term or condition of these Terms; (c) your violation of any third-party right, including any intellectual property or privacy right; (d) your violation of any applicable law or regulation; or (e) any damage you cause to any third party.</p>

        <h2 style={heading}>10. Force Majeure</h2>
        <p style={text}>We shall not be liable for any failure or delay in providing the Services due to events beyond our reasonable control, including but not limited to natural disasters, wars, terrorism, government actions, blockchain network failures (e.g., Base network outages), cyberattacks, power outages, or internet outages. In such cases, we will make reasonable efforts to restore access to the Services as soon as practicable.</p>

        <h2 style={heading}>11. Termination</h2>
        <p style={text}>We may suspend or terminate your access to the Services at any time, without prior notice, for any reason, including suspected violations of these Terms. Upon termination, your license to use the Services ends immediately. The provisions of these Terms relating to liability, indemnification, dispute resolution, and disclaimers shall survive termination.</p>

        <h2 style={heading}>12. Dispute Resolution</h2>
        <p style={text}>These Terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of laws principles. Any disputes arising from or relating to these Terms or your use of the Services that cannot be resolved informally shall be resolved through binding arbitration. <span style={bold}>You waive any right to participate in class action lawsuits or class-wide arbitration.</span></p>

        <h2 style={heading}>13. Changes to These Terms</h2>
        <p style={text}>We may update these Terms at any time by posting the revised version on the Website. Continued use of the Services after changes constitutes your acceptance of the revised Terms. We encourage you to check periodically for updates.</p>

        <h2 style={heading}>14. Privacy</h2>
        <p style={text}>Your use of the Services is subject to our Privacy Policy, available on the Website, which explains how we collect, use, and protect your information. By using the Services, you consent to such practices.</p>

        <h2 style={heading}>15. Entire Agreement</h2>
        <p style={text}>These Terms constitute the entire agreement between you and us with respect to the subject matter hereof and supersede any and all prior or contemporaneous written and oral agreements, communications, and other understandings.</p>

        <h2 style={heading}>16. Contact Information</h2>
        <p style={text}>If you have any questions about these Terms, please contact us through our official Discord server or on X (Twitter) at <span style={bold}>@minebean_</span>.</p>

        <p style={{ ...text, marginTop: 40, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)' }}><span style={bold}>By using the Services, you acknowledge that you have read, understood, and agree to these Terms.</span></p>
      </div>
      {isMobile && <BottomNav currentPage="about" />}
    </div>
  )
}
