'use client'

import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import { useState, useEffect } from 'react'

export default function Privacy() {
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

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', paddingBottom: isMobile ? '80px' : '0' }}>
      <Header currentPage="about" isMobile={isMobile} />
      <div style={{ maxWidth: 1200, margin: '0', padding: isMobile ? '32px 20px 60px' : '48px 40px 80px 160px' }}>

        <h1 style={{ fontSize: isMobile ? 28 : 36, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>Privacy Policy</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', margin: '0 0 40px' }}>Effective Date: February 18, 2026</p>

        <p style={text}>This Privacy Policy (the <span style={bold}>&quot;Policy&quot;</span>) explains how BEAN Protocol (<span style={bold}>&quot;we,&quot; &quot;our,&quot;</span> or <span style={bold}>&quot;us&quot;</span>) collects, uses, discloses, and protects your information when you use the website at minebean.com (the <span style={bold}>&quot;Website&quot;</span>) and the associated BEAN mining protocol services (the <span style={bold}>&quot;Services&quot;</span>). By accessing or using the Website or Services, you agree to this Privacy Policy. If you do not agree, you must not use the Services.</p>

        <p style={text}>The Services are permissionless and wallet-based, requiring no user registration, account creation, or personally identifiable information (PII) such as names or email addresses to participate in mining. Privacy is central to everything we do, and we minimize data collection wherever possible.</p>

        <h2 style={heading}>1. Information We Collect</h2>

        <h3 style={subheading}>1.1 Blockchain Data</h3>
        <p style={text}>When you interact with the Services using a non-custodial cryptocurrency wallet, we may collect:</p>
        <p style={text}>(a) Your public wallet address, used to identify transactions on the Base blockchain.</p>
        <p style={text}>(b) Transaction details, such as ETH deployed, round results, BEAN earned, staking activity, and claims made through the Protocol, as recorded on the public Base blockchain.</p>
        <p style={text}>Note that blockchain addresses are publicly-available data that are not created or assigned by us or any central party, and by themselves are not personally identifying. All blockchain-related data is publicly available on the Base blockchain and is not directly controlled by us.</p>

        <h3 style={subheading}>1.2 Profile Information</h3>
        <p style={text}>If you choose to create a user profile, you may voluntarily provide:</p>
        <p style={text}>(a) A username</p>
        <p style={text}>(b) A profile picture</p>
        <p style={text}>(c) A bio or description</p>
        <p style={text}>(d) Links to social media accounts (X/Twitter, Discord)</p>
        <p style={text}><span style={bold}>All profile information you provide is public and accessible by anyone.</span> We will not attempt to link your profile information to your real-world identity. You do not need to create a profile to use the core mining functionality of the Services.</p>

        <h3 style={subheading}>1.3 Technical Data</h3>
        <p style={text}>We may automatically collect the following technical information when you visit the Website:</p>
        <p style={text}>(a) IP addresses</p>
        <p style={text}>(b) Browser type and version</p>
        <p style={text}>(c) Device information and operating system</p>
        <p style={text}>(d) Referring URLs</p>
        <p style={text}>(e) Pages visited, time spent, and general usage patterns</p>
        <p style={text}>This information is used solely to maintain and improve the Services.</p>

        <h3 style={subheading}>1.4 Cookies and Tracking Technologies</h3>
        <p style={text}>We may use cookies, localStorage, web beacons, or similar browser-based technologies to collect technical and usage data. These help us understand how you interact with the Website, remember your preferences (such as display settings or terms acceptance status), and improve our Services. You can manage cookie preferences through your browser settings, but disabling cookies may affect Website functionality.</p>

        <h3 style={subheading}>1.5 Voluntarily Provided Information</h3>
        <p style={text}>If you contact us (e.g., via Discord, X/Twitter, or other support channels), we may collect information you provide, such as your username or message content.</p>

        <h2 style={heading}>2. How We Use Your Information</h2>
        <p style={text}>We use the information we collect to:</p>
        <p style={text}>(a) <span style={bold}>Provide the Services:</span> Facilitate your interaction with the Website and the Protocol&apos;s smart contracts on the Base blockchain.</p>
        <p style={text}>(b) <span style={bold}>Improve the Services:</span> Monitor and analyze Website usage to improve functionality, performance, and user experience.</p>
        <p style={text}>(c) <span style={bold}>Customer Support:</span> Respond to inquiries or support requests if you contact us.</p>
        <p style={text}>(d) <span style={bold}>Safety and Security:</span> Detect, prevent, or investigate fraud, abuse, or security issues. We may screen wallet addresses for prior illicit activity using publicly available blockchain data.</p>
        <p style={text}>(e) <span style={bold}>Legal Compliance:</span> Comply with applicable laws, regulations, or legal processes.</p>

        <h2 style={heading}>3. How We Share Your Information</h2>
        <p style={text}>We do not sell, rent, or trade your information to third parties for marketing or advertising purposes. We may share information as follows:</p>
        <p style={text}><span style={bold}>Public Blockchain Data:</span> Your wallet address and transaction details are recorded on the Base blockchain, which is publicly accessible and not controlled by us.</p>
        <p style={text}><span style={bold}>Service Providers:</span> We may share technical data with third-party providers who assist us in operating the Website. These include:</p>
        <p style={text}>(a) <span style={bold}>RainbowKit</span> — Wallet connection user interface</p>
        <p style={text}>(b) <span style={bold}>wagmi</span> — Blockchain interaction library</p>
        <p style={text}>(c) <span style={bold}>Base (Coinbase L2)</span> — The underlying blockchain network</p>
        <p style={text}>(d) <span style={bold}>Cloudflare</span> — Content delivery, image hosting, and infrastructure</p>
        <p style={text}>(e) <span style={bold}>Vercel</span> — Website hosting and deployment</p>
        <p style={text}>These providers may process data in accordance with their own privacy policies.</p>
        <p style={text}><span style={bold}>Legal Compliance:</span> We may disclose information to comply with laws, respond to legal processes (e.g., subpoenas), or protect our rights, property, or safety.</p>
        <p style={text}><span style={bold}>Business Transfers:</span> If BEAN Protocol undergoes a merger, acquisition, or asset sale, your information may be transferred as part of the transaction, subject to confidentiality obligations.</p>

        <h2 style={heading}>4. Data We Do Not Collect</h2>
        <p style={text}>We want to be transparent about what we do <span style={bold}>not</span> collect:</p>
        <p style={text}>(a) We do not collect your real name, email address, phone number, or physical address.</p>
        <p style={text}>(b) We do not collect or store private keys or seed phrases.</p>
        <p style={text}>(c) We do not attempt to link wallet addresses to real-world identities.</p>
        <p style={text}>(d) We do not sell, rent, or trade any user data to third parties for marketing or advertising purposes.</p>
        <p style={text}>(e) We do not use cookies for third-party advertising or cross-site tracking.</p>

        <h2 style={heading}>5. Data Security</h2>
        <p style={text}>We implement reasonable technical and organizational measures to protect your information from unauthorized access, loss, or misuse. However, no system is completely secure, and we cannot guarantee the security of your data, especially blockchain data, which is inherently public.</p>
        <p style={text}>You are responsible for securing your cryptocurrency wallet and private keys. We strongly recommend that you:</p>
        <p style={text}>(a) Never share your private keys or seed phrases with anyone.</p>
        <p style={text}>(b) Use hardware wallets for significant holdings.</p>
        <p style={text}>(c) Verify all transaction details before confirming.</p>
        <p style={text}>(d) Be cautious of phishing attempts and only access the Services through minebean.com.</p>

        <h2 style={heading}>6. Data Retention</h2>
        <p style={text}>We retain technical and usage data for as long as necessary to provide the Services, comply with legal obligations, or resolve disputes. Blockchain data (e.g., wallet addresses, transactions) is permanently stored on the Base blockchain and is not controlled by us. You can clear your browser&apos;s localStorage at any time to remove locally stored preferences.</p>

        <h2 style={heading}>7. Third-Party Links and Services</h2>
        <p style={text}>The Website may contain links to third-party websites, services, or resources (e.g., Base blockchain explorers, wallet providers). We do not control and are not responsible for their privacy practices. We encourage you to review the privacy policies of any third-party services you access.</p>

        <h2 style={heading}>8. Your Rights and Choices</h2>
        <p style={text}>Because we minimize data collection and do not maintain traditional user accounts:</p>
        <p style={text}>(a) You can disconnect your wallet at any time to stop interacting with the Services.</p>
        <p style={text}>(b) You can clear your browser&apos;s localStorage to remove locally stored preferences.</p>
        <p style={text}>(c) You can manage cookie preferences through your browser settings.</p>
        <p style={text}>(d) Profile information may be updated or cleared through the Website.</p>
        <p style={text}>(e) Blockchain data cannot be deleted or modified due to the immutable nature of blockchain technology. This is inherent to the technology and not within our control.</p>

        <h2 style={heading}>9. Children&apos;s Privacy</h2>
        <p style={text}>The Services are not intended for users under 18 or the age of majority in their jurisdiction. We do not knowingly collect information from minors. If we learn such information has been collected, we will take steps to delete it. If you become aware that a child has provided us with personal data, please contact us.</p>

        <h2 style={heading}>10. International Users</h2>
        <p style={text}>The Services are operated from a decentralized infrastructure. If you are accessing the Services from outside the jurisdiction in which we operate, please be aware that your information may be transferred to, stored, and processed in various locations. By using the Services, you consent to the transfer of information to these locations.</p>

        <h2 style={heading}>11. Changes to This Privacy Policy</h2>
        <p style={text}>We may update this Policy from time to time by posting the revised version on the Website. Continued use of the Services after changes constitutes your acceptance of the updated Policy. We encourage you to check periodically for updates.</p>

        <h2 style={heading}>12. Contact Us</h2>
        <p style={text}>If you have any questions about this Policy or how we collect, use, or share your information, please contact us through our official Discord server or on X (Twitter) at <span style={bold}>@minebean_</span>.</p>

      </div>
      {isMobile && <BottomNav currentPage="about" />}
    </div>
  )
}
