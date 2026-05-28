import { NextResponse } from 'next/server'
import { verifyMessage } from 'viem'
import { supabase } from '@/lib/supabase'

export async function GET(_req: Request, { params }: { params: { address: string } }) {
  const address = (await params).address.toLowerCase()

  const { data } = await supabase
    .from('profiles')
    .select('username, bio, pfp_url, banner_url')
    .eq('wallet_address', address)
    .single()

  return NextResponse.json({
    username: data?.username ?? null,
    bio: data?.bio ?? null,
    pfpUrl: data?.pfp_url ?? null,
    bannerUrl: data?.banner_url ?? null,
  })
}

export async function PUT(req: Request, { params }: { params: { address: string } }) {
  const address = (await params).address.toLowerCase()

  const body = await req.json()
  const { username, bio, pfpUrl, bannerUrl, signature, timestamp } = body

  // Reject stale requests (>5 min old)
  const now = Math.floor(Date.now() / 1000)
  if (!timestamp || Math.abs(now - timestamp) > 300) {
    return NextResponse.json({ error: 'Expired timestamp' }, { status: 401 })
  }

  // Verify the wallet signature - reconstruct expected message server-side
  try {
    const expectedMessage = `BEAN Protocol Profile Update\nAddress: ${address}\nTimestamp: ${timestamp}`
    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message: expectedMessage,
      signature,
    })
    if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Validate image fields
  const validateImage = (val: unknown, field: string) => {
    if (val === undefined || val === null) return null
    if (typeof val !== 'string') return `${field}: must be a string`
    if (val.length > 200_000) return `${field}: image too large (max 200KB)`
    if (!val.startsWith('data:image/jpeg') && !val.startsWith('data:image/png')) {
      return `${field}: only JPEG and PNG allowed`
    }
    return null
  }

  const pfpError = validateImage(pfpUrl, 'pfpUrl')
  if (pfpError) return NextResponse.json({ error: pfpError }, { status: 400 })

  const bannerError = validateImage(bannerUrl, 'bannerUrl')
  if (bannerError) return NextResponse.json({ error: bannerError }, { status: 400 })

  // Validate text fields
  if (username !== undefined && username !== null) {
    if (typeof username !== 'string') return NextResponse.json({ error: 'username: must be a string' }, { status: 400 })
    if (username.length > 20) return NextResponse.json({ error: 'username: max 20 characters' }, { status: 400 })
  }
  if (bio !== undefined && bio !== null) {
    if (typeof bio !== 'string') return NextResponse.json({ error: 'bio: must be a string' }, { status: 400 })
    if (bio.length > 160) return NextResponse.json({ error: 'bio: max 160 characters' }, { status: 400 })
  }

  // Only upsert fields that were provided
  const row: Record<string, unknown> = {
    wallet_address: address,
    updated_at: new Date().toISOString(),
  }
  if (username !== undefined) row.username = username
  if (bio !== undefined) row.bio = bio
  if (pfpUrl !== undefined) row.pfp_url = pfpUrl
  if (bannerUrl !== undefined) row.banner_url = bannerUrl

  const { error } = await supabase
    .from('profiles')
    .upsert(row, { onConflict: 'wallet_address' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
