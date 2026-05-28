import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'
import { supabase } from '@/lib/supabase'
import { CONTRACTS } from '@/lib/contracts'

const publicClient = createPublicClient({ chain: base, transport: http() })

export async function GET(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/profile?discord=error`)
  }

  // Verify state matches cookie
  const cookieStore = await cookies()
  const storedState = cookieStore.get('discord_state')?.value
  if (state !== storedState) {
    return NextResponse.redirect(`${appUrl}/profile?discord=error`)
  }

  const wallet = Buffer.from(state, 'base64url').toString()

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${appUrl}/api/auth/discord/callback`,
      }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) {
      return NextResponse.redirect(`${appUrl}/profile?discord=error`)
    }

    // Get Discord user info
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const discordUser = await userRes.json()

    // Check total BEAN exposure on-chain (liquid + staked + unclaimed)
    const walletAddr = wallet as `0x${string}`
    const [liquidBalance, stakeInfo, pendingRewards] = await Promise.all([
      publicClient.readContract({
        address: CONTRACTS.Bean.address,
        abi: CONTRACTS.Bean.abi,
        functionName: 'balanceOf',
        args: [walletAddr],
      }),
      publicClient.readContract({
        address: CONTRACTS.Staking.address,
        abi: CONTRACTS.Staking.abi,
        functionName: 'getStakeInfo',
        args: [walletAddr],
      }),
      publicClient.readContract({
        address: CONTRACTS.GridMining.address,
        abi: CONTRACTS.GridMining.abi,
        functionName: 'getTotalPendingRewards',
        args: [walletAddr],
      }),
    ])

    const liquid = Number(liquidBalance) / 1e18
    const staked = Number((stakeInfo as bigint[])[0]) / 1e18
    const unroasted = Number((pendingRewards as bigint[])[1]) / 1e18
    const roasted = Number((pendingRewards as bigint[])[2]) / 1e18
    const totalBean = liquid + staked + unroasted + roasted
    console.log(`[Discord] wallet=${wallet} discordUser=${discordUser.username} liquid=${liquid} staked=${staked} unroasted=${unroasted} roasted=${roasted} total=${totalBean}`)

    // Assign Holder role if total >= 1 BEAN
    if (totalBean >= 1) {
      console.log(`[Discord] assigning Holder role - guildId=${process.env.DISCORD_GUILD_ID} userId=${discordUser.id} roleId=${process.env.DISCORD_HOLDER_ROLE_ID}`)
      const roleRes = await fetch(
        `https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUser.id}/roles/${process.env.DISCORD_HOLDER_ROLE_ID}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json',
            'X-Audit-Log-Reason': 'BEAN holder verification',
          },
        }
      )
      console.log(`[Discord] Holder role assign status=${roleRes.status}`, await roleRes.text())
    } else {
      console.log(`[Discord] skipping Holder role - total ${totalBean} below threshold`)
    }

    // Assign Whale role if total >= 100 BEAN
    if (totalBean >= 100) {
      console.log(`[Discord] assigning Whale role - userId=${discordUser.id} roleId=${process.env.DISCORD_WHALE_ROLE_ID}`)
      const whaleRes = await fetch(
        `https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUser.id}/roles/${process.env.DISCORD_WHALE_ROLE_ID}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json',
            'X-Audit-Log-Reason': 'BEAN whale verification (100+ BEAN)',
          },
        }
      )
      console.log(`[Discord] Whale role assign status=${whaleRes.status}`, await whaleRes.text())
    }

    // Save to Supabase
    await supabase.from('social_connections').upsert({
      wallet_address: wallet.toLowerCase(),
      discord_id: discordUser.id,
      discord_username: discordUser.username,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'wallet_address' })

    const response = NextResponse.redirect(`${appUrl}/profile?discord=connected`)
    response.cookies.delete('discord_state')
    return response
  } catch (err) {
    console.error('Discord callback error:', err)
    return NextResponse.redirect(`${appUrl}/profile?discord=error`)
  }
}
