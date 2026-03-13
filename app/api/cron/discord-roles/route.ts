import { NextResponse } from 'next/server'
import { createPublicClient, http, fallback } from 'viem'
import { base } from 'viem/chains'
import { supabase } from '@/lib/supabase'
import { CONTRACTS } from '@/lib/contracts'

const CRON_SECRET = process.env.CRON_SECRET
const GUILD_ID = process.env.DISCORD_GUILD_ID!
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!
const HOLDER_ROLE_ID = process.env.DISCORD_HOLDER_ROLE_ID!
const WHALE_ROLE_ID = process.env.DISCORD_WHALE_ROLE_ID!

const HOLDER_THRESHOLD = 1
const WHALE_THRESHOLD = 100

const publicClient = createPublicClient({
  chain: base,
  transport: fallback([
    http('https://base.llamarpc.com'),
    http('https://rpc.ankr.com/base'),
    http('https://mainnet.base.org'),
    http('https://base-rpc.publicnode.com'),
  ]),
})

async function getTotalBean(wallet: `0x${string}`): Promise<number> {
  const [liquidBalance, stakeInfo, pendingRewards] = await Promise.all([
    publicClient.readContract({
      address: CONTRACTS.Bean.address,
      abi: CONTRACTS.Bean.abi,
      functionName: 'balanceOf',
      args: [wallet],
    }),
    publicClient.readContract({
      address: CONTRACTS.Staking.address,
      abi: CONTRACTS.Staking.abi,
      functionName: 'getStakeInfo',
      args: [wallet],
    }),
    publicClient.readContract({
      address: CONTRACTS.GridMining.address,
      abi: CONTRACTS.GridMining.abi,
      functionName: 'getTotalPendingRewards',
      args: [wallet],
    }),
  ])

  const liquid = Number(liquidBalance as bigint) / 1e18
  const staked = Number((stakeInfo as bigint[])[0]) / 1e18
  const unroasted = Number((pendingRewards as bigint[])[1]) / 1e18
  const roasted = Number((pendingRewards as bigint[])[2]) / 1e18
  return liquid + staked + unroasted + roasted
}

async function setRole(discordId: string, roleId: string, grant: boolean) {
  const method = grant ? 'PUT' : 'DELETE'
  const res = await fetch(
    `https://discord.com/api/guilds/${GUILD_ID}/members/${discordId}/roles/${roleId}`,
    {
      method,
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Audit-Log-Reason': 'BEAN balance sync',
      },
    }
  )
  return res.status
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: connections, error } = await supabase
    .from('social_connections')
    .select('wallet_address, discord_id')
    .not('discord_id', 'is', null)

  if (error) {
    console.error('[role-sync] Supabase error:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!connections || connections.length === 0) {
    return NextResponse.json({ message: 'No users to sync', synced: 0 })
  }

  const results = { holder_granted: 0, holder_revoked: 0, whale_granted: 0, whale_revoked: 0, errors: 0 }

  // Process in batches of 5 to avoid hammering the RPC
  const BATCH_SIZE = 5
  for (let i = 0; i < connections.length; i += BATCH_SIZE) {
    const batch = connections.slice(i, i + BATCH_SIZE)

    await Promise.all(batch.map(async ({ wallet_address, discord_id }) => {
      try {
        const total = await getTotalBean(wallet_address as `0x${string}`)
        const isHolder = total >= HOLDER_THRESHOLD
        const isWhale = total >= WHALE_THRESHOLD

        const [holderStatus, whaleStatus] = await Promise.all([
          setRole(discord_id, HOLDER_ROLE_ID, isHolder),
          setRole(discord_id, WHALE_ROLE_ID, isWhale),
        ])

        if (holderStatus === 204) isHolder ? results.holder_granted++ : results.holder_revoked++
        if (whaleStatus === 204) isWhale ? results.whale_granted++ : results.whale_revoked++

        console.log(`[role-sync] ${wallet_address} total=${total.toFixed(2)} holder=${isHolder} whale=${isWhale} holderStatus=${holderStatus} whaleStatus=${whaleStatus}`)
      } catch (err) {
        console.error(`[role-sync] Error for ${wallet_address}:`, err)
        results.errors++
      }
    }))

    // Small delay between batches
    if (i + BATCH_SIZE < connections.length) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  console.log('[role-sync] Done:', results)
  return NextResponse.json({ synced: connections.length, ...results })
}
